using MarquitosArcade.Data;
using Microsoft.AspNetCore.Identity;

namespace MarquitosArcade.Account;

public record CurrentUserDto(string? DisplayName);

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/account/me", async (HttpContext httpContext, UserManager<ApplicationUser> userManager) =>
        {
            if (httpContext.User.Identity?.IsAuthenticated != true)
                return Results.Ok(new CurrentUserDto(null));

            var user = await userManager.GetUserAsync(httpContext.User);
            return Results.Ok(new CurrentUserDto(user?.DisplayName));
        });
    }
}
