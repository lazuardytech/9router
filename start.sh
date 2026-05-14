docker stop pod
docker rm pod
docker pull lazuardytech/pod:latest
docker run -d --name pod -p 20128:20128 --env-file .env -v pod-data:/app/data lazuardytech/pod:latest
