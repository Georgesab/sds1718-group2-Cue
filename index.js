const express = require('express')
const app = express()
const port = 4000

app.get('/', (request, response) => {
	response.send('hello\n')
})

app.listen(port, (err) => {
	if(err) {
		return console.log('something bad', err)
	}

	console.log(`listening on port $(port)`)
})