# 🗄️ Database Architecture & Data Modeling

## 🎯 Objective
Ensure data integrity, performance, and efficient retrieval.

## 📐 Data Modeling
- **Relational (SQL):** PostgreSQL/MySQL for strong consistency and complex relationships.
- **NoSQL:** MongoDB (document), Redis (K/V), Cassandra (wide-column) for specific scale/flexibility needs.
- **Indexing:** B-Tree, GIN, Hash indexes. Avoid over-indexing.

## 🚀 Optimization
- **Query Optimization:** Explain plans, N+1 problem mitigation.
- **Scaling:** Connection pooling, Read Replicas, Sharding, Partitioning.
- **Consistency:** ACID vs Eventual Consistency (CAP Theorem).
