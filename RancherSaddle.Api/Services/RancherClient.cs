using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace RancherSaddle.Api.Services
{
    public interface IRancherClient
    {
        Task<T?> GetAsync<T>(string endpoint);
        Task<TResponse?> PostAsync<TRequest, TResponse>(string endpoint, TRequest data);
        Task<bool> DeleteAsync(string endpoint);
        Task<string> GetClusterHealth();
        Task<List<Models.PodPodDto>> GetPodsAsync(string clusterId);
        Task<string> GetPodLogsAsync(string clusterId, string podId, int tailLines);
    }

    public class RancherClient : IRancherClient
    {
        private readonly HttpClient _httpClient;
        private readonly ITokenService _tokenService;
        private readonly ILogger<RancherClient> _logger;

        public RancherClient(HttpClient httpClient, ITokenService tokenService, ILogger<RancherClient> logger)
        {
            _httpClient = httpClient;
            _tokenService = tokenService;
            _logger = logger;
        }

        private async Task EnsureAuthenticatedAsync()
        {
            var token = _tokenService.GetToken();
            if (string.IsNullOrEmpty(token))
            {
                throw new UnauthorizedAccessException("Rancher API token is missing.");
            }
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        public async Task<T?> GetAsync<T>(string endpoint)
        {
            await EnsureAuthenticatedAsync();
            try
            {
                var response = await _httpClient.GetAsync(endpoint);
                return await HandleResponseAsync<T>(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during GET request to {Endpoint}", endpoint);
                throw;
            }
        }

        public async Task<TResponse?> PostAsync<TRequest, TResponse>(string endpoint, TRequest data)
        {
            await EnsureAuthenticatedAsync();
            try
            {
                var content = new StringContent(JsonSerializer.Serialize(data), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(endpoint, content);
                return await HandleResponseAsync<TResponse>(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during POST request to {Endpoint}", endpoint);
                throw;
            }
        }

        public async Task<bool> DeleteAsync(string endpoint)
        {
            await EnsureAuthenticatedAsync();
            try
            {
                var response = await _httpClient.DeleteAsync(endpoint);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during DELETE request to {Endpoint}", endpoint);
                throw;
            }
        }

        public async Task<List<Models.PodPodDto>> GetPodsAsync(string clusterId)
        {
            var pods = await GetAsync<List<Models.PodPodDto>>($"v3/clusters/{clusterId}/pods");
            return pods ?? new List<Models.PodPodDto>();
        }

        public async Task<string> GetPodLogsAsync(string clusterId, string podId, int tailLines)
        {
            var endpoint = $"v3/clusters/{clusterId}/pods/{podId}/logs?tail={tailLines}";
            var logContent = await GetAsync<string>(endpoint);
            return logContent ?? "No logs found.";
        }

        public async Task<string> GetClusterHealth()
        {
            var result = await GetAsync<JsonElement>("v3/clusters"); 
            return result.ValueKind != JsonValueKind.Undefined && result.ValueKind != JsonValueKind.Null ? "Healthy (Real)" : "Unhealthy";
        }

        private async Task<T?> HandleResponseAsync<T>(HttpResponseMessage response)
        {
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<T>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }

            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                throw new UnauthorizedAccessException("Invalid or expired Rancher token.");
            }

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                throw new KeyNotFoundException("The requested Rancher resource was not found.");
            }

            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Rancher API error: {response.StatusCode} - {errorContent}");
        }
    }
}
