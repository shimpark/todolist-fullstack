# 1. Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["TodoApi.csproj", "./"]
RUN dotnet restore "TodoApi.csproj"

# Copy remaining source code and publish
COPY . .
RUN dotnet publish "TodoApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 2. Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# SQLite DB volume directory
RUN mkdir -p /data

EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080
ENV DB_CONNECTION_STRING="Data Source=/data/todos.db"

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TodoApi.dll"]
