#FROM node:12.18.4-buster
FROM node:16

RUN apt-get -y update && apt-get -y install

# Create app directory
RUN mkdir /usr/src/app
COPY . /usr/src/app
WORKDIR /usr/src/app/server/

RUN npm update
RUN npm install
EXPOSE 55555
ENTRYPOINT ["npm", "start"]