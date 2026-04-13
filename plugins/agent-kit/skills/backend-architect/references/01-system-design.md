# 🏗️ System Design & Distributed Patterns

## 🎯 Objective
Design systems that are decoupled, scalable, and maintainable.

## 🧱 Architectural Patterns
- **Layered Architecture:** Clear separation of concerns (Presentation, Business, Data).
- **Microservices:** Domain-driven decomposition.
- **Event-Driven Architecture (EDA):** Use message brokers (Kafka, RabbitMQ) for asynchronous decoupling.
- **Serverless:** Event-triggered functions for cost-effective scaling.

## 🚦 Communication
- **Synchronous:** REST, gRPC (for high-performance internal service-to-service).
- **Asynchronous:** Pub/Sub, Work Queues.
- **Load Balancing:** L4/L7 balancing, health checks, and service discovery.
