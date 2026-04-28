FROM python:3.11-slim

WORKDIR /app

# 安装必要的系统依赖、Pandoc 和中文字体
RUN apt-get update && apt-get install -y \
    pandoc \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-latex-extra \
    fonts-wqy-microhei \
    && rm -rf /var/lib/apt/lists/*

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 入口脚本
RUN chmod +x /app/entrypoint.sh

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["/app/entrypoint.sh"]
