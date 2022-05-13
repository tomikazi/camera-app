FROM node:latest

WORKDIR /usr/src/app
COPY . .
RUN npm install minimist
RUN npm install

EXPOSE 8000
CMD ["node", "camera-app.js", "--broker=cam.demo", "--port=8080", "--camera=Demo"]
