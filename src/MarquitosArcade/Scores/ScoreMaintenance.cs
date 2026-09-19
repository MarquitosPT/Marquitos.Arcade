using MarquitosArcade.Data;
using Microsoft.EntityFrameworkCore;

namespace MarquitosArcade.Scores;

/// <summary>
/// Limpeza da tabela <c>Scores</c> no arranque.
///
/// A eliminação de uma conta apaga as pontuações dessa conta na mesma transação
/// (ver <c>Components/Account/Pages/Manage/DeletePersonalData.razor</c>), mas
/// isso só passou a acontecer depois de o site já estar no ar: as contas
/// eliminadas antes disso deixaram para trás linhas com um <c>UserId</c> que já
/// não existe em <c>AspNetUsers</c>. Essas linhas continuavam a aparecer nos
/// tops, com o nome de quem pediu para sair — o contrário do que a política de
/// privacidade promete —, por isso o arranque varre-as a seguir às migrations.
///
/// Não há chave estrangeira entre <c>Scores.UserId</c> e <c>AspNetUsers.Id</c>
/// que tratasse disto em cascata: acrescentá-la obrigaria o SQLite a reconstruir
/// a tabela e falharia logo na migration por causa destas mesmas órfãs.
/// </summary>
public static class ScoreMaintenance
{
    /// <summary>
    /// Apaga as pontuações que apontam para contas que já não existem. As
    /// pontuações de visitantes (<c>UserId</c> a <c>null</c>) nunca são tocadas
    /// — não pertencem a conta nenhuma, logo não ficam órfãs.
    /// </summary>
    /// <returns>Quantas linhas foram apagadas.</returns>
    public static async Task<int> RemoveOrphanScoresAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var removed = await db.Scores
            .Where(s => s.UserId != null && !db.Users.Any(u => u.Id == s.UserId))
            .ExecuteDeleteAsync(cancellationToken);

        if (removed > 0)
        {
            scope.ServiceProvider
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger(typeof(ScoreMaintenance))
                .LogInformation("Apagadas {Count} pontuação(ões) de contas já eliminadas.", removed);
        }

        return removed;
    }
}
