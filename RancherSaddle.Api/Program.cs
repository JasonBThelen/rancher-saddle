var builder = WebApplication.CreateBuilder(args);

// Add CORS policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("WebPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5000", "https://localhost:5001", "http://localhost:3000", "https://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<RancherSaddle.Api.Services.ITokenService, RancherSaddle.Api.Services.TokenService>();

var useMockClient = builder.Configuration.GetValue<bool>("UseMockClient");
if (useMockClient)
{
    builder.Services.AddSingleton<RancherSaddle.Api.Services.IRancherClient, RancherSaddle.Api.Services.MockRancherClient>();
}
else
{
    builder.Services.AddHttpClient<RancherSaddle.Api.Services.IRancherClient, RancherSaddle.Api.Services.RancherClient>(client => 
    {
        client.BaseAddress = new Uri(builder.Configuration["RancherApiBaseUrl"] ?? "https://rancher.mycompany.com");
    });
}

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("WebPolicy");
app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.MapGet("/api/token", (HttpContext context, RancherSaddle.Api.Services.ITokenService tokenService) =>
{
    var token = context.Request.Headers["X-Rancher-Token"].ToString();
    if (!string.IsNullOrEmpty(token))
    {
        tokenService.SetToken(token);
        return Results.Ok(new { status = "Token updated" });
    }
    return Results.Ok(new { status = "Request token via header" });
})
.WithName("GetToken")
.WithOpenApi();

app.MapGet("/api/rancher/health", async (RancherSaddle.Api.Services.IRancherClient rancherClient) =>
{
    var health = await rancherClient.GetClusterHealth();
    return Results.Ok(new { status = health });
})
.WithName("GetRancherHealth")
.WithOpenApi();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
