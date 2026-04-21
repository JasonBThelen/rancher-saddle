# Rancher Saddle - Mobile-First Rancher Wrapper

A lightweight, mobile-optimized wrapper for the Rancher API designed for high-glare industrial environments (Dairy/Ag Tech).

## 🚀 Quick Start

### Build and Run
1. Build the solution:
   `dotnet build RancherSaddle.sln`
2. Run the API:
   `dotnet run --project RancherSaddle.Api`
3. Run the Web client:
   `dotnet run --project RancherSaddle.Web`

### Deployment
Deploy to your on-prem Kubernetes cluster using the provided manifests:
`kubectl apply -f deploy/k8s/`

## 🛠️ Tech Stack
- **Backend**: ASP.NET Core 8/9 (Minimal APIs)
- **Frontend**: Blazor WebAssembly (Mobile-first CSS)
- **API**: Rancher REST API Proxy

## 🎯 Key Features
- **Cluster Health Dashboard**: At-a-glance status with color-coded health indicators.
- **Pod Management**: Swift pod listing and "One-Tap" restarts with safety confirmation.
- **Streamlined Logs**: Tail-log viewer optimized for mobile data and screen size.
- **Saddle Proxy**: Secure Bearer token forwarding to Rancher.
