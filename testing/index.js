var FCM = require('fcm-push');

var serverKey = 'AAAA7qf1S-s:APA91bHj07GD0akUObgNBy8VnF2HGjrgZ5OJRtaBTmK3yTS_aYQV3vnlbE75laH3GOcg_FTwe2aYosIFC3mXDkFUxTO4N-yJe2Zda31uQUyxod73FGSPBFUIF_7uzDIQ34IiCi_kGewV';
var fcm = new FCM(serverKey);

var message = {
    to: 'fyXUXueWMOE:APA91bEGNvd3tpabf3enYo4ooSnPM1l9s3RTLrKKNhLGlGspT0F2QjqqzCdbLcyfnMIHShQr8mhmP_Lrcdm_obNyT8b5MtiHQ2P7qAeSscO0hnQkje0oxQ7Or5zJ9pbfsPuepR0bGyiz', // required fill with device token or topics
    notification: {
        title: 'Traintracks',
        body: 'This app sucks. Download the official TrainLine app.'
    }
};

//callback style
fcm.send(message, function(err, response){
    if (err) {
        console.log("Something has gone wrong!");
    } else {
        console.log("Successfully sent with response: ", response);
    }
});
