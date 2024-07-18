const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
const port = 5000;


app.use(cors());
app.use(express.json());


const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'Nomekop151!') 
);

const session = driver.session();

app.get('/api/check-connection', async (req, res) => {
  try {
    await session.run('RETURN 1');
    res.send('Connection to Neo4j is successful!');
  } catch (err) {
    console.error('Neo4j connection error:', err.message);
    res.status(500).send('Neo4j connection failed');
  }
});
//
app.get('/api/symptoms', async (req, res) => {
  const query = 'MATCH (s:Symptom) RETURN s.name AS name';

  try {
    const session = driver.session();
    const result = await session.run(query);
    const symptoms = result.records.map(record => record.get('name'));
    res.json(symptoms);
  } catch (err) {
    console.error('Error fetching symptoms:', err.message);
    res.status(500).send('Server error');
  }
});
//
app.post('/api/find-diseases', async (req, res) => {
  const { symptoms } = req.body;
  console.log('Received symptoms:', symptoms);

  const query = `
    MATCH (s:Symptom)-[r:CAUSES]->(d:Disease)
    WHERE s.name IN $symptoms AND NOT d.name IN $symptoms
    WITH d, r.tfidf_score AS score
    RETURN d.name AS disease, SUM(score) AS relevanceScore
    ORDER BY relevanceScore DESC
    LIMIT 5
  `;

  try {
    const result = await session.run(query, { symptoms });
    if (result.records.length > 0) {
      const diseases = result.records.map(record => ({
        disease: record.get('disease'),
        relevanceScore: record.get('relevanceScore')
      }));
      console.log({diseases});
      res.json(diseases);
    } else {
      res.json({ message: 'No matching diseases found' });
    }
  } catch (err) {
    console.error('Error executing query:', err.message);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

process.on('exit', async () => {
  await driver.close();
});
