const express = require('express');
const app = express();
var path = require('path');

var staticPath = path.join(__dirname, '/public');
app.use(express.static(staticPath));

//app.get('/', (req, res) => res.send('Hello World!'));

app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

