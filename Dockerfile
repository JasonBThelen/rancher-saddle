# multistage build for .NET 8
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy everything and restore
COPY . .
RUN dotnet restore "RancherSaddle.sln"

# Build and publish API
RUN dotnet publish "RancherSaddle.Api/RancherSaddle.Api.csproj" -c Release -o /app/publish-api

# Build and publish Web
RUN dotnet publish "RancherSaddle.Web/RancherSaddle.Web.csproj" -c Release -o /app/publish-web

# Final Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish-api .

# Copy Web assets to the API's wwwroot (if serving as one unit)
# Or deploy as separate pods. For the "Saddle" we'll serve it as a single unit for simplicity.
COPY --from=build /app/publish-web /app/wwwroot

EXPOSE 80
EXPOSE 443
ENTRYPOINT ["dotnet", "RancherSaddle.Api.dll"]
