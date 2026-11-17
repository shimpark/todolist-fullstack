using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TodoApi.Data;
using TodoApi.Models;

namespace TodoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(TodoDbContext db, IConfiguration config) : ControllerBase
{
    public const int MinimumZxcvbnScore = 3; // 0~4 scale (3 = Safely unguessable, 4 = Very unguessable)
    private static readonly PasswordHasher<AppUser> LegacyHasher = new();

    public static bool ValidatePasswordPolicy(string username, string password, out string error)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8 || password.Length > 64)
        {
            error = "비밀번호는 8자 이상 64자 이하여야 합니다.";
            return false;
        }
        if (password.Any(char.IsWhiteSpace))
        {
            error = "비밀번호에는 공백을 포함할 수 없습니다.";
            return false;
        }
        if (!password.Any(char.IsUpper) || !password.Any(char.IsLower))
        {
            error = "비밀번호에는 영문 대문자와 소문자가 모두 포함되어야 합니다.";
            return false;
        }
        if (!password.Any(char.IsDigit))
        {
            error = "비밀번호에는 숫자가 최소 1자 이상 포함되어야 합니다.";
            return false;
        }
        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            error = "비밀번호에는 특수문자가 최소 1자 이상 포함되어야 합니다.";
            return false;
        }

        var trimmedUsername = username?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(trimmedUsername) &&
            password.Contains(trimmedUsername, StringComparison.OrdinalIgnoreCase))
        {
            error = "비밀번호에 아이디를 포함할 수 없습니다.";
            return false;
        }

        // Dropbox zxcvbn 오픈소스 엔진 기반 사전 단어/키보드 패턴/엔트로피 강도 평가 (0~4점)
        var zxcvbnResult = Zxcvbn.Core.EvaluatePassword(password, new[] { trimmedUsername });
        if (zxcvbnResult.Score < MinimumZxcvbnScore)
        {
            error = "추측하기 쉬운 단어(예: password, qwerty)나 단순 패턴이 포함되어 있습니다. 더 복잡한 비밀번호를 사용해 주세요.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] AuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
        {
            return BadRequest("Username is required.");
        }

        var username = request.Username.Trim();
        if (username.Length < 2 || username.Length > 50)
        {
            return BadRequest("Username must be between 2 and 50 characters.");
        }

        if (!ValidatePasswordPolicy(username, request.Password, out var passwordError))
        {
            return BadRequest(passwordError);
        }

        var exists = await db.Users.AnyAsync(u => u.Username == username);
        if (exists)
        {
            return Conflict("Username already exists.");
        }

        var user = new AppUser
        {
            Username = username,
            // BCrypt.Net-Next 오픈소스 라이브러리를 사용한 솔트 포함 적응형 해싱
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse(token, user.Username));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] AuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest("Username and password are required.");
        }

        var username = request.Username.Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user is null)
        {
            return Unauthorized("Invalid username or password.");
        }

        var isValid = false;
        var needsHashUpgrade = false;

        if (user.PasswordHash.StartsWith("$2", StringComparison.Ordinal))
        {
            try
            {
                isValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            }
            catch (SaltParseException)
            {
                isValid = false;
            }
        }
        else
        {
            // 이전 버전(PasswordHasher PBKDF2)으로 저장된 계정 호환 및 자동 BCrypt 마이그레이션
            try
            {
                var legacyResult = LegacyHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
                if (legacyResult != PasswordVerificationResult.Failed)
                {
                    isValid = true;
                    needsHashUpgrade = true;
                }
            }
            catch
            {
                isValid = false;
            }
        }

        if (!isValid)
        {
            return Unauthorized("Invalid username or password.");
        }

        if (needsHashUpgrade)
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            await db.SaveChangesAsync();
        }

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse(token, user.Username));
    }

    private string GenerateJwtToken(AppUser user)
    {
        var secret = config["JWT_SECRET_KEY"] ?? config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
        {
            throw new InvalidOperationException("JWT_SECRET_KEY is not configured properly.");
        }
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username)
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record AuthRequest(string Username, string Password);
public record AuthResponse(string Token, string Username);
