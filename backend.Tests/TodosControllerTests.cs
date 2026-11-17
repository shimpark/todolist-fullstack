using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TodoApi.Controllers;
using TodoApi.Data;
using TodoApi.Models;
using Xunit;

namespace TodoApi.Tests;

public sealed class TodosControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly TodoDbContext _db;
    private readonly TodosController _controller;

    public TodosControllerTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<TodoDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new TodoDbContext(options);
        _db.Database.EnsureCreated();

        _controller = CreateControllerForUser(userId: 1);
    }

    private TodosController CreateControllerForUser(int userId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, $"user{userId}")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        return new TodosController(_db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task CreateTodo_ValidRequest_ReturnsCreatedTodo()
    {
        var dueDate = new DateOnly(2026, 12, 31);
        var request = new CreateTodoRequest(" 백엔드 테스트 작성 ", TodoPriority.High, dueDate, TodoCategory.Study);

        var result = await _controller.CreateTodo(request);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var todo = Assert.IsType<TodoItem>(createdResult.Value);
        Assert.True(todo.Id > 0);
        Assert.Equal(1, todo.UserId);
        Assert.Equal("백엔드 테스트 작성", todo.Title); // Trimmed
        Assert.False(todo.IsCompleted);
        Assert.Equal(TodoPriority.High, todo.Priority);
        Assert.Equal(TodoCategory.Study, todo.Category);
        Assert.Equal(dueDate, todo.DueDate);
    }

    [Theory]
    [InlineData(TodoCategory.Work)]
    [InlineData(TodoCategory.Personal)]
    [InlineData(TodoCategory.Study)]
    public async Task CreateTodo_ValidRequest_SavesCategoryCorrectly(TodoCategory category)
    {
        var request = new CreateTodoRequest("카테고리 저장 테스트", TodoPriority.Medium, null, category);

        var result = await _controller.CreateTodo(request);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var todo = Assert.IsType<TodoItem>(createdResult.Value);
        Assert.Equal(category, todo.Category);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateTodo_EmptyOrWhitespaceTitle_ReturnsBadRequest(string invalidTitle)
    {
        var request = new CreateTodoRequest(invalidTitle, TodoPriority.Medium, null);

        var result = await _controller.CreateTodo(request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateTodo_TitleExceeds200Chars_ReturnsBadRequest()
    {
        var longTitle = new string('A', 201);
        var request = new CreateTodoRequest(longTitle, TodoPriority.Medium, null);

        var result = await _controller.CreateTodo(request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateTodo_InvalidPriority_ReturnsBadRequest()
    {
        var request = new CreateTodoRequest("유효하지 않은 우선순위", (TodoPriority)99, null);

        var result = await _controller.CreateTodo(request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateTodo_InvalidCategory_ReturnsBadRequest()
    {
        var request = new CreateTodoRequest("유효하지 않은 카테고리", TodoPriority.Medium, null, (TodoCategory)99);

        var result = await _controller.CreateTodo(request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetTodos_WithSearchAndFilters_ReturnsMatchingItems()
    {
        _db.Todos.AddRange(
            new TodoItem { UserId = 1, Title = "React 컴포넌트 테스트", IsCompleted = false, Priority = TodoPriority.High, Category = TodoCategory.Study },
            new TodoItem { UserId = 1, Title = "React 상태 관리 정리", IsCompleted = true, Priority = TodoPriority.Medium, Category = TodoCategory.Study },
            new TodoItem { UserId = 1, Title = "ASP.NET Core API 배포", IsCompleted = false, Priority = TodoPriority.High, Category = TodoCategory.Work }
        );
        await _db.SaveChangesAsync();

        // 1) 키워드 검색: "React"
        var searchResult = await _controller.GetTodos(search: "React");
        var searchedItems = Assert.IsAssignableFrom<IEnumerable<TodoItem>>(searchResult.Value);
        Assert.Equal(2, searchedItems.Count());

        // 2) 미완료 + 높음 우선순위 필터
        var filterResult = await _controller.GetTodos(isCompleted: false, priority: TodoPriority.High);
        var filteredItems = Assert.IsAssignableFrom<IEnumerable<TodoItem>>(filterResult.Value);
        Assert.Equal(2, filteredItems.Count());

        // 3) 복합 조건: 검색("React") + 미완료(false) + 우선순위(High)
        var combinedResult = await _controller.GetTodos(search: "React", isCompleted: false, priority: TodoPriority.High);
        var combinedItems = Assert.IsAssignableFrom<IEnumerable<TodoItem>>(combinedResult.Value).ToList();
        Assert.Single(combinedItems);
        Assert.Equal("React 컴포넌트 테스트", combinedItems[0].Title);
    }

    [Fact]
    public async Task GetTodos_FilterByCategory_ReturnsMatchingItems()
    {
        _db.Todos.AddRange(
            new TodoItem { UserId = 1, Title = "분기 보고서 작성", Category = TodoCategory.Work },
            new TodoItem { UserId = 1, Title = "운동 가기", Category = TodoCategory.Personal },
            new TodoItem { UserId = 1, Title = "TypeScript 제네릭 복습", Category = TodoCategory.Study },
            new TodoItem { UserId = 1, Title = "EF Core 쿼리 튜닝 학습", Category = TodoCategory.Study }
        );
        await _db.SaveChangesAsync();

        var studyResult = await _controller.GetTodos(category: TodoCategory.Study);
        var studyItems = Assert.IsAssignableFrom<IEnumerable<TodoItem>>(studyResult.Value).ToList();
        Assert.Equal(2, studyItems.Count);
        Assert.All(studyItems, item => Assert.Equal(TodoCategory.Study, item.Category));

        var personalResult = await _controller.GetTodos(category: TodoCategory.Personal);
        var personalItems = Assert.IsAssignableFrom<IEnumerable<TodoItem>>(personalResult.Value).ToList();
        Assert.Single(personalItems);
        Assert.Equal("운동 가기", personalItems[0].Title);
    }

    [Fact]
    public async Task GetTodo_ExistingAndNonExisting_ReturnsExpectedResult()
    {
        var created = new TodoItem { UserId = 1, Title = "단건 조회 테스트", Priority = TodoPriority.Low, Category = TodoCategory.Personal };
        _db.Todos.Add(created);
        await _db.SaveChangesAsync();

        var existingResult = await _controller.GetTodo(created.Id);
        var okResult = Assert.IsType<OkObjectResult>(existingResult.Result);
        var item = Assert.IsType<TodoItem>(okResult.Value);
        Assert.Equal("단건 조회 테스트", item.Title);
        Assert.Equal(TodoCategory.Personal, item.Category);

        var notFoundResult = await _controller.GetTodo(9999);
        Assert.IsType<NotFoundResult>(notFoundResult.Result);
    }

    [Fact]
    public async Task UpdateTodo_ValidRequest_UpdatesAllFields()
    {
        var item = new TodoItem
        {
            UserId = 1,
            Title = "초기 제목",
            IsCompleted = false,
            Priority = TodoPriority.Low,
            Category = TodoCategory.Work,
            DueDate = null
        };
        _db.Todos.Add(item);
        await _db.SaveChangesAsync();

        var newDue = new DateOnly(2026, 11, 30);
        var updateReq = new UpdateTodoRequest("수정된 제목", true, TodoPriority.High, newDue, TodoCategory.Study);

        var result = await _controller.UpdateTodo(item.Id, updateReq);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var updated = Assert.IsType<TodoItem>(okResult.Value);
        Assert.Equal("수정된 제목", updated.Title);
        Assert.True(updated.IsCompleted);
        Assert.Equal(TodoPriority.High, updated.Priority);
        Assert.Equal(TodoCategory.Study, updated.Category);
        Assert.Equal(newDue, updated.DueDate);
    }

    [Fact]
    public async Task UpdateTodo_InvalidCategory_ReturnsBadRequest()
    {
        var item = new TodoItem { UserId = 1, Title = "초기 제목", Category = TodoCategory.Work };
        _db.Todos.Add(item);
        await _db.SaveChangesAsync();

        var updateReq = new UpdateTodoRequest("수정 제목", false, TodoPriority.Medium, null, (TodoCategory)99);
        var result = await _controller.UpdateTodo(item.Id, updateReq);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateTodo_NonExisting_ReturnsNotFound()
    {
        var updateReq = new UpdateTodoRequest("없는 항목 수정", true, TodoPriority.Medium, null, TodoCategory.Work);

        var result = await _controller.UpdateTodo(9999, updateReq);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task DeleteTodo_ExistingAndNonExisting_ReturnsExpectedStatus()
    {
        var item = new TodoItem { UserId = 1, Title = "삭제 대상" };
        _db.Todos.Add(item);
        await _db.SaveChangesAsync();

        var deleteResult = await _controller.DeleteTodo(item.Id);
        Assert.IsType<NoContentResult>(deleteResult);

        var secondDeleteResult = await _controller.DeleteTodo(item.Id);
        Assert.IsType<NotFoundResult>(secondDeleteResult);
    }

    [Fact]
    public async Task ClearCompletedTodos_RemovesOnlyCompletedItems()
    {
        _db.Todos.AddRange(
            new TodoItem { UserId = 1, Title = "진행 중 1", IsCompleted = false },
            new TodoItem { UserId = 1, Title = "완료됨 1", IsCompleted = true },
            new TodoItem { UserId = 1, Title = "완료됨 2", IsCompleted = true }
        );
        await _db.SaveChangesAsync();

        var clearResult = await _controller.ClearCompletedTodos();
        Assert.IsType<NoContentResult>(clearResult);

        var remaining = await _db.Todos.AsNoTracking().ToListAsync();
        Assert.Single(remaining);
        Assert.Equal("진행 중 1", remaining[0].Title);
    }

    [Fact]
    public async Task GetDueAlerts_ClassifiesOverdueTodayAndSoonCorrectly()
    {
        var refDate = new DateOnly(2026, 11, 18);

        _db.Todos.AddRange(
            new TodoItem { UserId = 1, Title = "기한 초과 미완료", IsCompleted = false, DueDate = new DateOnly(2026, 11, 17) },
            new TodoItem { UserId = 1, Title = "기한 초과 완료됨(제외대상)", IsCompleted = true, DueDate = new DateOnly(2026, 11, 17) },
            new TodoItem { UserId = 1, Title = "오늘 마감 미완료", IsCompleted = false, DueDate = new DateOnly(2026, 11, 18) },
            new TodoItem { UserId = 1, Title = "내일 마감(D-1) 미완료", IsCompleted = false, DueDate = new DateOnly(2026, 11, 19) },
            new TodoItem { UserId = 1, Title = "다음주 마감(제외대상)", IsCompleted = false, DueDate = new DateOnly(2026, 11, 25) },
            new TodoItem { UserId = 1, Title = "마감일 없음(제외대상)", IsCompleted = false, DueDate = null }
        );
        await _db.SaveChangesAsync();

        var result = await _controller.GetDueAlerts(referenceDate: refDate, daysAhead: 1);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var alerts = Assert.IsType<DueAlertsResponse>(okResult.Value);

        Assert.Equal(1, alerts.OverdueCount);
        Assert.Single(alerts.OverdueItems);
        Assert.Equal("기한 초과 미완료", alerts.OverdueItems[0].Title);

        Assert.Equal(1, alerts.DueTodayCount);
        Assert.Single(alerts.DueTodayItems);
        Assert.Equal("오늘 마감 미완료", alerts.DueTodayItems[0].Title);

        Assert.Equal(1, alerts.DueSoonCount);
        Assert.Single(alerts.DueSoonItems);
        Assert.Equal("내일 마감(D-1) 미완료", alerts.DueSoonItems[0].Title);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(31)]
    public async Task GetDueAlerts_InvalidDaysAhead_ReturnsBadRequest(int invalidDaysAhead)
    {
        var result = await _controller.GetDueAlerts(referenceDate: new DateOnly(2026, 11, 18), daysAhead: invalidDaysAhead);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UserIsolation_UserCannotAccessOrModifyAnotherUsersTodos()
    {
        var userAController = CreateControllerForUser(userId: 1);
        var userBController = CreateControllerForUser(userId: 2);

        // 유저 A와 유저 B 각각 할 일 생성
        var createAResult = await userAController.CreateTodo(new CreateTodoRequest("유저 A의 비밀 할 일"));
        var todoA = Assert.IsType<TodoItem>(Assert.IsType<CreatedAtActionResult>(createAResult.Result).Value);

        var createBResult = await userBController.CreateTodo(new CreateTodoRequest("유저 B의 개인 할 일"));
        var todoB = Assert.IsType<TodoItem>(Assert.IsType<CreatedAtActionResult>(createBResult.Result).Value);

        // 1) 유저 A가 목록 조회 시 본인의 할 일만 반환됨
        var listAResult = await userAController.GetTodos();
        var listA = Assert.IsAssignableFrom<IEnumerable<TodoItem>>(listAResult.Value).ToList();
        Assert.Single(listA);
        Assert.Equal("유저 A의 비밀 할 일", listA[0].Title);

        // 2) 유저 A가 유저 B의 할 일을 단건 조회/수정/삭제 시도 시 모두 404 NotFound 반환
        var getOtherResult = await userAController.GetTodo(todoB.Id);
        Assert.IsType<NotFoundResult>(getOtherResult.Result);

        var updateOtherResult = await userAController.UpdateTodo(
            todoB.Id,
            new UpdateTodoRequest("해킹 시도", true, TodoPriority.High, null, TodoCategory.Work)
        );
        Assert.IsType<NotFoundResult>(updateOtherResult.Result);

        var deleteOtherResult = await userAController.DeleteTodo(todoB.Id);
        Assert.IsType<NotFoundResult>(deleteOtherResult);

        // 유저 B의 할 일은 여전히 안전하게 유지됨
        var verifyBResult = await userBController.GetTodo(todoB.Id);
        var okB = Assert.IsType<OkObjectResult>(verifyBResult.Result);
        Assert.Equal("유저 B의 개인 할 일", Assert.IsType<TodoItem>(okB.Value).Title);
    }
}
