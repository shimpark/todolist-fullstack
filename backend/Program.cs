using System.Security.Cryptography;
using System.Text;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using TodoApi.Data;

var builder = WebApplication.CreateBuilder(args);

// .env 파일 자동 초기화(없을 경우 CSPRNG 난수 키 생성) 및 로드
var envPath = Path.Combine(builder.Environment.ContentRootPath, ".env");
if (!File.Exists(envPath))
{
    var generatedKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    var initialEnvContent = string.Join(Environment.NewLine,
        "# Auto-generated local development .env (ignored by git)",
        $"JWT_SECRET_KEY={generatedKey}",
        "DB_CONNECTION_STRING=Data Source=todos.db",
        "FRONTEND_ORIGIN=http://localhost:5173",
        "");
    File.WriteAllText(envPath, initialEnvContent, Encoding.UTF8);
}

Env.Load(envPath);
builder.Configuration.AddEnvironmentVariables();

var jwtKey = builder.Configuration["JWT_SECRET_KEY"] ?? builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "JWT_SECRET_KEY must be configured in .env (or environment variables) and be at least 32 bytes.");
}

var connectionString = builder.Configuration["DB_CONNECTION_STRING"]
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=todos.db";

// SQLite DB 파일의 부모 디렉토리가 존재하는지 확인 및 자동 생성
if (connectionString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
{
    var rawPath = connectionString["Data Source=".Length..].Trim();
    if (!string.IsNullOrEmpty(rawPath) && rawPath != ":memory:")
    {
        var dbDir = Path.GetDirectoryName(rawPath);
        if (!string.IsNullOrEmpty(dbDir) && !Directory.Exists(dbDir))
        {
            Directory.CreateDirectory(dbDir);
        }
    }
}

var rawFrontendOrigins = builder.Configuration["FRONTEND_ORIGIN"] ?? "http://localhost:5173";
var frontendOrigins = rawFrontendOrigins
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks()
    .AddDbContextCheck<TodoDbContext>();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "발급받은 JWT 토큰을 입력하세요."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<TodoDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        if (frontendOrigins.Length == 1 && frontendOrigins[0] == "*")
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
        }
        else
        {
            policy.WithOrigins(frontendOrigins)
                  .SetIsOriginAllowedToAllowWildcardSubdomains()
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
        }
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TodoDbContext>();
    db.Database.EnsureCreated();
    try
    {
        // Verify schema has Users table and TodoItem.UserId, Priority, Category, DueDate columns; recreate if outdated
        _ = db.Users.OrderBy(u => u.Id).Select(u => u.Username).FirstOrDefault();
        _ = db.Todos.OrderBy(t => t.Id).Select(t => new { t.UserId, t.Priority, t.Category, t.DueDate }).FirstOrDefault();
    }
    catch
    {
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();
    }
}

var enableSwagger = app.Environment.IsDevelopment()
    || string.Equals(app.Configuration["ENABLE_SWAGGER"], "true", StringComparison.OrdinalIgnoreCase);

app.UseExceptionHandler();

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/healthz");

app.Run();
