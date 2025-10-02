FROM public.ecr.aws/docker/library/python:3.12.2-slim-bullseye
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=8080
WORKDIR /var/task
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN python -m pip install -r requirements.txt
COPY . .
CMD exec uvicorn --port=$PORT main:app