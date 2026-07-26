APP_VERSION := $(shell git describe --tags --exact-match 2>/dev/null | sed 's/^v//' || git rev-parse --short HEAD)

.PHONY: build build-multi up up-multi down

build:
	docker compose build --build-arg APP_VERSION=$(APP_VERSION)

build-multi:
	docker compose -f docker-compose.multi-cluster.yml build --build-arg APP_VERSION=$(APP_VERSION)

up:
	APP_VERSION=$(APP_VERSION) docker compose up -d

up-multi:
	APP_VERSION=$(APP_VERSION) docker compose -f docker-compose.multi-cluster.yml up -d

down:
	docker compose down
