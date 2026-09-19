using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MarquitosArcade.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<ScoreEntry> Scores => Set<ScoreEntry>();

    public DbSet<GameProgressEntry> GameProgress => Set<GameProgressEntry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ScoreEntry>()
            .HasIndex(s => new { s.GameId, s.Score });

        // Uma linha por (conta, jogo): o progresso é o estado atual do jogador,
        // não um histórico. O índice único é o que garante que uma gravação
        // concorrente de dois separadores não deixa duas linhas a discordar.
        builder.Entity<GameProgressEntry>()
            .HasIndex(p => new { p.UserId, p.GameId })
            .IsUnique();

        builder.Entity<GameProgressEntry>()
            .Property(p => p.Data)
            .HasMaxLength(GameProgressEntry.MaxDataLength);

        builder.Entity<ApplicationUser>()
            .Property(u => u.DisplayName)
            .HasMaxLength(50);
    }
}
