const express = require('express');
const app = express();

app.listen(5500, function(){
    console.log('listening on 5500')
});


app.get('/item', function(request, require){
    require.send('아이템을 보여주는 페이지입니다.');
})

app.get('/', function(request,require){
    require.sendFile(__dirname + '/index.html')
})