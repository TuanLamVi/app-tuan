importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// These values are from firebase-applet-config.json
firebase.initializeApp({
  projectId: "thiepmoi-74103698-dbe87",
  appId: "1:294963219705:web:a2a7a4dfb8801cf4e3a628",
  apiKey: "AIzaSyBjWM4CoGmezvADuSTl5XSnPd2ntugyh4M",
  authDomain: "thiepmoi-74103698-dbe87.firebaseapp.com",
  storageBucket: "thiepmoi-74103698-dbe87.firebasestorage.app",
  messagingSenderId: "294963219705"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'Thông báo mới';
  const notificationOptions = {
    body: payload.notification.body || 'Bạn có một thông báo mới từ ứng dụng MyGroup.',
    icon: 'https://www.gstatic.com/images/branding/product/1x/notifications_v2_48dp.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
