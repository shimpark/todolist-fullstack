using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using TodoApi.Data;
using Xunit;

namespace TodoApi.Tests;

public sealed class HealthCheckTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _serviceProvider;

    public HealthCheckTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<TodoDbContext>(options =>
            options.UseSqlite(_connection));

        services.AddHealthChecks()
            .AddDbContextCheck<TodoDbContext>();

        _serviceProvider = services.BuildServiceProvider();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TodoDbContext>();
        db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _serviceProvider.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task HealthCheck_WhenDatabaseIsConnected_ReturnsHealthyStatus()
    {
        var healthCheckService = _serviceProvider.GetRequiredService<HealthCheckService>();
        var report = await healthCheckService.CheckHealthAsync();

        Assert.Equal(HealthStatus.Healthy, report.Status);
        Assert.True(report.Entries.ContainsKey(nameof(TodoDbContext)));
        Assert.Equal(HealthStatus.Healthy, report.Entries[nameof(TodoDbContext)].Status);
    }
}
