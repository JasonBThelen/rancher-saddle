namespace RancherSaddle.Shared.Models
{
    public record ClusterStatusDto(
        string Id,
        string Name,
        string Status,
        int RunningPods,
        int FailedPods
    );

    public record PodPodDto(
        string Id,
        string Name,
        string Status
    );

    public record RancherCluster(
        string Id,
        string Name,
        string Status
    );
}
