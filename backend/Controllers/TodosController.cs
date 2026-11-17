using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Data;
using TodoApi.Models;

namespace TodoApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TodosController(TodoDbContext db) : ControllerBase
{
    private int GetCurrentUserId()
    {
        var claim = User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(claim, out var userId) && userId > 0)
        {
            return userId;
        }
        throw new UnauthorizedAccessException("Valid user identifier claim is required.");
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TodoItem>>> GetTodos(
        [FromQuery] string? search = null,
        [FromQuery] bool? isCompleted = null,
        [FromQuery] TodoPriority? priority = null,
        [FromQuery] TodoCategory? category = null)
    {
        var userId = GetCurrentUserId();
        var query = db.Todos.AsNoTracking().Where(t => t.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            query = query.Where(t => EF.Functions.Like(t.Title, $"%{keyword}%"));
        }

        if (isCompleted.HasValue)
        {
            query = query.Where(t => t.IsCompleted == isCompleted.Value);
        }

        if (priority.HasValue)
        {
            query = query.Where(t => t.Priority == priority.Value);
        }

        if (category.HasValue)
        {
            query = query.Where(t => t.Category == category.Value);
        }

        return await query
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TodoItem>> GetTodo(int id)
    {
        var userId = GetCurrentUserId();
        var todo = await db.Todos.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        return todo is null ? NotFound() : Ok(todo);
    }

    [HttpPost]
    public async Task<ActionResult<TodoItem>> CreateTodo([FromBody] CreateTodoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest("Title is required.");
        }

        var trimmedTitle = request.Title.Trim();
        if (trimmedTitle.Length > 200)
        {
            return BadRequest("Title must not exceed 200 characters.");
        }

        if (!Enum.IsDefined(request.Priority))
        {
            return BadRequest("Invalid priority value.");
        }

        if (!Enum.IsDefined(request.Category))
        {
            return BadRequest("Invalid category value.");
        }

        var userId = GetCurrentUserId();
        var todo = new TodoItem
        {
            UserId = userId,
            Title = trimmedTitle,
            IsCompleted = false,
            Priority = request.Priority,
            Category = request.Category,
            DueDate = request.DueDate,
            CreatedAt = DateTime.UtcNow
        };

        db.Todos.Add(todo);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTodo), new { id = todo.Id }, todo);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<TodoItem>> UpdateTodo(int id, [FromBody] UpdateTodoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest("Title is required.");
        }

        var trimmedTitle = request.Title.Trim();
        if (trimmedTitle.Length > 200)
        {
            return BadRequest("Title must not exceed 200 characters.");
        }

        if (!Enum.IsDefined(request.Priority))
        {
            return BadRequest("Invalid priority value.");
        }

        if (!Enum.IsDefined(request.Category))
        {
            return BadRequest("Invalid category value.");
        }

        var userId = GetCurrentUserId();
        var todo = await db.Todos.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (todo is null)
        {
            return NotFound();
        }

        todo.Title = trimmedTitle;
        todo.IsCompleted = request.IsCompleted;
        todo.Priority = request.Priority;
        todo.Category = request.Category;
        todo.DueDate = request.DueDate;

        await db.SaveChangesAsync();
        return Ok(todo);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTodo(int id)
    {
        var userId = GetCurrentUserId();
        var deletedCount = await db.Todos.Where(t => t.Id == id && t.UserId == userId).ExecuteDeleteAsync();
        return deletedCount == 0 ? NotFound() : NoContent();
    }

    [HttpDelete("completed")]
    public async Task<IActionResult> ClearCompletedTodos()
    {
        var userId = GetCurrentUserId();
        await db.Todos.Where(t => t.UserId == userId && t.IsCompleted).ExecuteDeleteAsync();
        return NoContent();
    }

    [HttpGet("due-alerts")]
    public async Task<ActionResult<DueAlertsResponse>> GetDueAlerts(
        [FromQuery] DateOnly? referenceDate = null,
        [FromQuery] int daysAhead = 1)
    {
        if (daysAhead < 0 || daysAhead > 30)
        {
            return BadRequest("daysAhead must be between 0 and 30.");
        }

        var userId = GetCurrentUserId();
        var targetDate = referenceDate ?? DateOnly.FromDateTime(DateTime.Now);
        var soonLimitDate = targetDate.AddDays(daysAhead);

        var candidates = await db.Todos
            .AsNoTracking()
            .Where(t => t.UserId == userId && !t.IsCompleted && t.DueDate != null && t.DueDate <= soonLimitDate)
            .OrderBy(t => t.DueDate)
            .ThenByDescending(t => t.Priority)
            .ToListAsync();

        var overdueItems = candidates.Where(t => t.DueDate < targetDate).ToList();
        var dueTodayItems = candidates.Where(t => t.DueDate == targetDate).ToList();
        var dueSoonItems = candidates.Where(t => t.DueDate > targetDate && t.DueDate <= soonLimitDate).ToList();

        var response = new DueAlertsResponse(
            OverdueCount: overdueItems.Count,
            DueTodayCount: dueTodayItems.Count,
            DueSoonCount: dueSoonItems.Count,
            OverdueItems: overdueItems,
            DueTodayItems: dueTodayItems,
            DueSoonItems: dueSoonItems
        );

        return Ok(response);
    }
}

public record DueAlertsResponse(
    int OverdueCount,
    int DueTodayCount,
    int DueSoonCount,
    IReadOnlyList<TodoItem> OverdueItems,
    IReadOnlyList<TodoItem> DueTodayItems,
    IReadOnlyList<TodoItem> DueSoonItems
);

public record CreateTodoRequest(
    string Title,
    TodoPriority Priority = TodoPriority.Medium,
    DateOnly? DueDate = null,
    TodoCategory Category = TodoCategory.Work
);

public record UpdateTodoRequest(
    string Title,
    bool IsCompleted,
    TodoPriority Priority,
    DateOnly? DueDate,
    TodoCategory Category = TodoCategory.Work
);
