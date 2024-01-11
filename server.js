const express = require('express');
const app = express();

app.listen(5500, function(){
    console.log('listening on 5500');
});

app.get('/', function(request, response){  
    response.sendFile(__dirname + '/index.html');
});