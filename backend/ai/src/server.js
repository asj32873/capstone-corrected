const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');
const app = express();
app.use(helmet()); app.use(cors()); app.use(express.json({ limit:'2mb' })); app.use(routes);
app.listen(env.port, ()=>console.log(`[ai] listening on http://localhost:${env.port}`));
