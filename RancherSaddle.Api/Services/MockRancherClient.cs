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
            
            if (endpoint.Contains("v3/clusters"))
            {
                var clusters = new List<Models.RancherCluster>
                {
                    new Models.RancherCluster("c-healthy", "Production-Cluster", "active"),
                    new Models.RancherCluster("c-failed", "Staging-Cluster", "active")
                };
                var json = JsonSerializer.Serialize(clusters);
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

        public Task<List<Models.PodPodDto>> GetPodsAsync(string clusterId)
        {
            _logger.LogInformation("MockRancherClient: GetPodsAsync for {ClusterId}", clusterId);
            var pods = new List<Models.PodPodDto>
            {
                new Models.PodPodDto("p1", "pod-1", "Running"),
                new Models.PodPodDto("p2", "pod-2", clusterId == "c-failed" ? "Failed" : "Running")
            };
            return Task.FromResult(pods);
        }

        public Task<string> GetPodLogsAsync(string clusterId, string podId, int tailLines)
        {
            _logger.LogInformation("MockRancherClient: GetPodLogsAsync for {ClusterId}/{PodId} (tail={Tail})", clusterId, podId, tailLines);
            var mockLogs = new System.Text.StringBuilder();
            for (int i = 1; i <= tailLines; i++)
            {
                mockLogs.AppendLine($"[{DateTime.Now.AddSeconds(-i)}] Mock log line {i} for pod {podId} in cluster {clusterId}...");
            }
            return Task.FromResult(mockLogs.ToString());
        }
    }
}
