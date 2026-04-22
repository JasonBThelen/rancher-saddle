using RancherSaddle.Shared.Models;

namespace RancherSaddle.Api.Services
{
    public interface ITokenService
    {
        string? GetToken();
        void SetToken(string token);
    }

    public class TokenService : ITokenService
    {
        private string? _token;

        public string? GetToken() => _token;

        public void SetToken(string token)
        {
            _token = token;
        }
    }
}
