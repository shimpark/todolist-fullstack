using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TodoApi.Controllers;
using TodoApi.Data;
using Xunit;

namespace TodoApi.Tests;

public sealed class AuthControllerTests : IDisposable
{
    private const string ValidStrongPassword = "K9#mP2$vL8@qR5";
    private readonly SqliteConnection _connection;
    private readonly TodoDbContext _db;
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<TodoDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new TodoDbContext(options);
        _db.Database.EnsureCreated();

        var randomTestSecret = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_SECRET_KEY"] = randomTestSecret
            })
            .Build();

        _controller = new AuthController(_db, config);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Register_ValidStrongPassword_ReturnsTokenAndCreatesBCryptHashedUser()
    {
        var request = new AuthRequest("  alice  ", ValidStrongPassword);

        var result = await _controller.Register(request);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.Equal("alice", response.Username);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));

        var savedUser = await _db.Users.SingleAsync(u => u.Username == "alice");
        Assert.NotEqual(ValidStrongPassword, savedUser.PasswordHash);
        Assert.StartsWith("$2", savedUser.PasswordHash); // BCrypt hash prefix ($2a$ / $2b$)
        Assert.True(BCrypt.Net.BCrypt.Verify(ValidStrongPassword, savedUser.PasswordHash));
    }

    [Fact]
    public async Task Register_DuplicateUsername_ReturnsConflict()
    {
        await _controller.Register(new AuthRequest("bob", ValidStrongPassword));

        var duplicateResult = await _controller.Register(new AuthRequest("BOB", "X7$nQ4!wZ9#pL2"));

        Assert.IsType<ConflictObjectResult>(duplicateResult.Result);
    }

    [Theory]
    [InlineData("", "K9#mP2$vL8@qR5")]           // 빈 아이디
    [InlineData("a", "K9#mP2$vL8@qR5")]          // 2자 미만 아이디
    [InlineData("validuser", "")]                // 빈 비밀번호
    [InlineData("validuser", "Ab1!xyz")]         // 8자 미만
    [InlineData("validuser", "k9#mp2$vl8@qr5")]  // 대문자 누락
    [InlineData("validuser", "K9#MP2$VL8@QR5")]  // 소문자 누락
    [InlineData("validuser", "Km#mPv$vLq@qRz")]  // 숫자 누락
    [InlineData("validuser", "K9mP2vL8qR5xYz")]  // 특수문자 누락
    [InlineData("validuser", "K9#mP2$ vL8@qR")]  // 공백 포함
    [InlineData("alice", "K9#mAlice8@qR5")]      // 아이디(Username) 포함
    [InlineData("validuser", "Password1!")]      // zxcvbn 사전 단어/단순 패턴 차단 (대/소/숫자/특수문자 있으나 취약)
    [InlineData("validuser", "Qwerty123!")]      // zxcvbn 키보드 패턴 차단
    public async Task Register_WeakOrDictionaryPassword_ReturnsBadRequest(string username, string password)
    {
        var result = await _controller.Register(new AuthRequest(username, password));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsToken()
    {
        await _controller.Register(new AuthRequest("charlie", ValidStrongPassword));

        var loginResult = await _controller.Login(new AuthRequest("charlie", ValidStrongPassword));

        var okResult = Assert.IsType<OkObjectResult>(loginResult.Result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.Equal("charlie", response.Username);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }

    [Theory]
    [InlineData("charlie", "WrongPass99!#X")]
    [InlineData("nonexistent", "K9#mP2$vL8@qR5")]
    public async Task Login_InvalidPasswordOrNonExistingUser_ReturnsUnauthorized(string username, string password)
    {
        await _controller.Register(new AuthRequest("charlie", ValidStrongPassword));

        var loginResult = await _controller.Login(new AuthRequest(username, password));

        Assert.IsType<UnauthorizedObjectResult>(loginResult.Result);
    }

    [Fact]
    public async Task Login_LegacyPbkdf2Hash_VerifiesAndUpgradesToBCryptHash()
    {
        var legacyHasher = new Microsoft.AspNetCore.Identity.PasswordHasher<TodoApi.Models.AppUser>();
        var legacyUser = new TodoApi.Models.AppUser
        {
            Username = "legacyuser",
            CreatedAt = DateTime.UtcNow
        };
        legacyUser.PasswordHash = legacyHasher.HashPassword(legacyUser, "1234");
        _db.Users.Add(legacyUser);
        await _db.SaveChangesAsync();

        // 1) 이전 PBKDF2 해시 계정으로 로그인 시 SaltParseException 없이 성공해야 함
        var loginResult = await _controller.Login(new AuthRequest("legacyuser", "1234"));
        var okResult = Assert.IsType<OkObjectResult>(loginResult.Result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.Equal("legacyuser", response.Username);

        // 2) 로그인 성공 후 DB 해시가 자동으로 BCrypt($2...) 포맷으로 업그레이드되었는지 확인
        var upgradedUser = await _db.Users.SingleAsync(u => u.Username == "legacyuser");
        Assert.StartsWith("$2", upgradedUser.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify("1234", upgradedUser.PasswordHash));
    }
}
