using System.Text.Json;

namespace RancherSaddle.Api.Services
{
    public class MockRancherClient : IRancherClient
    {
        private readonly ILogger<MockRancherClient> _logger;

        public MockRancherClient(ILogger<MockRancherClient> logger)
        {
            _logger = logger;
        }

        public Task<T?> GetAsync<T>(string endpoint)
        {
            _logger.LogInformation("MockRancherClient: GET {Endpoint}", endpoint);
            
            // Minimal mock mapping
            if (endpoint.Contains("v3/clusters"))
            {
                var mockResponse = new { status = "active", name = "mock-cluster" };
                var json = JsonSerializer.Serialize(mockResponse);
                return Task.FromResult(JsonSerializer.Deserialize<T>(json));
            }

            return Task.FromResult(default(T));
        }

        public Task<TResponse?> PostAsync<TRequest, TResponse>(string endpoint, TRequest data)
        {
            _logger.LogInformation("MockRancherClient: POST {Endpoint}", endpoint);
            return Task.FromResult(default(TResponse));
        }

        public Task<bool> DeleteAsync(string endpoint)
        {
            _logger.LogInformation("MockRancherClient: DELETE {Endpoint}", endpoint);
            return Task.FromResult(true);
        }

        public Task<string> GetClusterHealth()
        {
            return Task.FromResult("Healthy (Mock)");
        }
    }
}
