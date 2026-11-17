using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models;

public enum TodoPriority
{
    Low = 0,
    Medium = 1,
    High = 2
}

public enum TodoCategory
{
    Work = 0,
    Personal = 1,
    Study = 2
}

public class TodoItem
{
    public int Id { get; set; }

    public int UserId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public bool IsCompleted { get; set; }

    public TodoPriority Priority { get; set; } = TodoPriority.Medium;

    public TodoCategory Category { get; set; } = TodoCategory.Work;

    public DateOnly? DueDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
