using Microsoft.AspNetCore.Identity;

namespace MarquitosArcade.Data;

// Add profile data for application users by adding properties to the ApplicationUser class
public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// Nome público escolhido pelo utilizador (ex: usado nas pontuações). Nunca é o email.
    /// </summary>
    public string? DisplayName { get; set; }
}

