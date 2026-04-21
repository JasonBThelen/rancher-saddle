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

    public Task<<TT?> GetAsync<<TT>(string endpoint)
    {
        _logger.LogInformation("MockRancherClient: GET {Endpoint}", endpoint);
        
        if (endpoint.Contains("v3/clusters"))
        {
            var clusters = new List<<ModelsModels.RancherCluster>
            {
                new Models.RancherCluster("c-healthy", "Production-Cluster", "active"),
                new Models.RancherCluster("c-failed", "Staging-Cluster", "active")
            };
            var json = JsonSerializer.Serialize(clusters);
            return Task.FromResult(JsonSerializer.Deserialize<<TT>(json));
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
