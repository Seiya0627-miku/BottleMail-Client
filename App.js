import React, { useState, useRef, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, TextInput, Alert, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, 
  TouchableWithoutFeedback, Keyboard, Modal, Text, Pressable, Image, ImageBackground, FlatList,
  Animated, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import initialMessagesData from './data/messages.json';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

const windowWidth = Dimensions.get('window').width;
const ASYNC_STORAGE_MESSAGES_KEY = '@MyApp:messages';


// --- 便箋のサイズ制約 ---
const MAX_STATIONERY_WIDTH = 300;
const MAX_STATIONERY_HEIGHT = 400;
const TARGET_ASPECT_RATIO_H_W = 4 / 3; // 高さ / 幅 (400 / 300)
const MAX_SCREEN_WIDTH_PERCENTAGE = 0.8; // 画面幅の最大80%

// --- 便箋の実際のサイズを計算 ---
let actualStationeryWidth = windowWidth * MAX_SCREEN_WIDTH_PERCENTAGE;

// 1. 最大幅の制約を適用
if (actualStationeryWidth > MAX_STATIONERY_WIDTH) {
  actualStationeryWidth = MAX_STATIONERY_WIDTH;
}

// 2. この幅に基づいて、目標アスペクト比から高さを計算
let actualStationeryHeight = actualStationeryWidth * TARGET_ASPECT_RATIO_H_W;

// 3. 計算された高さが最大高さを超えていないか確認
if (actualStationeryHeight > MAX_STATIONERY_HEIGHT) {
  actualStationeryHeight = MAX_STATIONERY_HEIGHT;
  // 高さが制限されたので、アスペクト比を保つために幅を再計算
  actualStationeryWidth = actualStationeryHeight / TARGET_ASPECT_RATIO_H_W;
}

// --- 棚の表示サイズ制約 ---
const shelfAspectRatio_H_W = 1100 / 939;
// 棚の表示幅を決定 (画面幅の90%を上限とするが、アスペクト比を保った結果、高さが400を超えないように)
// まず、高さ400を基準に許容される最大の幅を計算
let MAX_SHELF_HEIGHT = 400 / shelfAspectRatio_H_W;

// 画面幅の80% (または90%)
let MAX_SHELF_WIDTH = windowWidth * 0.9; // 例: 90%

// より小さい方を棚の実際の表示幅とする
const actualShelfDisplayWidth = Math.min(MAX_SHELF_HEIGHT, MAX_SHELF_WIDTH);
const actualShelfDisplayHeight = actualShelfDisplayWidth * shelfAspectRatio_H_W;


export default function App() {
  // 設定
  const [settingsVisible, setSettingsVisible] = useState(false);
  const settingsButtonRotateAnim = useRef(new Animated.Value(0)).current; // 0: 0度, 1: 180度 を表現
  const [userId, setUserId] = useState("unknown-user"); // 初期値は適当な文字列
  const [tempUserId, setTempUserId] = useState(userId);
  const [serverIP, setServerIP] = useState('http://192.168.3.3:8000'); // デフォルト値
  const [tempIP, setTempIP] = useState(serverIP);
  const [preferences, setPreferences] = useState(''); // 実際に保存される設定
  const [tempPreferences, setTempPreferences] = useState(preferences); // 設定モーダル内の一時的な値

  const [isNewUser, setIsNewUser] = useState(null); // To track if user is new for tutorial
  const [isLoadingApp, setIsLoadingApp] = useState(true);

  useEffect(() => {
    // settingsVisible の状態に応じて、回転アニメーションを実行
    Animated.timing(settingsButtonRotateAnim, {
      toValue: settingsVisible ? 1 : 0, // settingsVisibleがtrueなら1(180度へ)、falseなら0(0度へ)
      duration: 300, // アニメーション時間 (0.3秒)
      useNativeDriver: true, // パフォーマンス向上のため
    }).start();
  }, [settingsVisible, settingsButtonRotateAnim]);

  const settingsButtonSpin = settingsButtonRotateAnim.interpolate({
    inputRange: [0, 1], // settingsButtonRotateAnim の値が0から1に変化する間に
    outputRange: ['0deg', '180deg'], // transformのrotateプロパティは'0deg'から'180deg'に変化
  });

  // 手紙ボックス
  const [boxVisible, setBoxVisible] = useState(false);
  const [readingMessage, setReadingMessage] = useState(null); // 現在読んでいる手紙
  const [messages, setMessages] = useState([]); // 手紙ボックスの内容。初期値は空配列
  const [isLoadingMessages, setIsLoadingMessages] = useState(false); // 手紙ボックスのローディング状態

  // アプリ起動時の処理
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoadingApp(true);

      let idForApp = null;
      let fetchedShortId = null; // To store the "user-xxxx" formatted ID

      // 1. ユーザーIDの生成
      try {
        let originalDeviceId = null;
        if (Platform.OS === 'android') {
          originalDeviceId = Application.androidId;
        } else if (Platform.OS === 'ios') {
          originalDeviceId = await Application.getIosIdForVendorAsync();
        }

        if (originalDeviceId) {
          const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            originalDeviceId,
            { encoding: Crypto.CryptoEncoding.HEX }
          );
          const desiredLength = 12;
          const hashedPart = digest.substring(0, desiredLength);
          fetchedShortId = `user-${hashedPart}`;
          idForApp = fetchedShortId; // Use this for server communication
        } else {
          idForApp = `user-fallback-${Math.random().toString(36).substring(2,8)}`; // Simple fallback
          Alert.alert("ID取得エラー", "デバイス固有IDの取得に失敗しました。一時IDを使用します。");
        }
        
        setUserId(idForApp);
        setTempUserId(idForApp); // For settings screen

      } catch (error) {
        console.error("Error initializing user ID:", error);
        idForApp = `user-error-${Math.random().toString(36).substring(2,8)}`;
        setUserId(idForApp);
        setTempUserId(idForApp);
        Alert.alert("ID初期化エラー", "ユーザーIDの準備中にエラーが発生しました。");
        return; // Stop initialization if ID generation fails critically
      }

      // 2. ユーザーIDをサーバーで確認
      if (idForApp && serverIP) {
        try {
          const response = await fetch(`${serverIP}/check_user/${idForApp}`, { method: 'POST' }); // Ensure this matches server endpoint
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          const data = await response.json();
          setIsNewUser(data.is_new_user);
          console.log(`User status from server for ${idForApp}: New user = ${data.is_new_user}`);
          // --- チュートリアル用に手紙一枚書かせる ---
          // if (data.is_new_user) {
          //   // TODO: Trigger tutorial flow
          //   Alert.alert("ようこそ！", "ボトルメッセージへようこそ。最初に手紙を書いてみましょう。");
          //   // For now, maybe open writing modal directly for new user after a slight delay or a welcome screen
          //   // setWritingVisible(true); // Example: Open writing modal for tutorial
          // }
        } catch (e) {
          console.error("Failed to check user status with server:", e);
          Alert.alert("サーバー接続エラー", "ユーザー情報の確認に失敗しました。ネットワーク接続を確認してください。");
          setIsNewUser(null); // Set to undecided or handle as error
        }

        // 3. 手紙ボックスの内容をロード (userIdが確定し、フォールバック/エラーIDでない場合)
        setIsLoadingMessages(true); // 手紙ボックスのローディング開始
        let loadedMessages = [];
        let loadedFromServer = false;

        // (A) まずサーバーから取得を試みる
        try {
          const letterboxUrl = `${serverIP}/letterbox/${idForApp}`;
          console.log("サーバーから手紙ボックスのロードを試みます:", letterboxUrl);
          const serverResponse = await fetch(letterboxUrl);

          if (serverResponse.ok) {
            const serverData = await serverResponse.json();
            loadedMessages = serverData;
            // サーバーから取得成功したら、ローカルストレージも更新
            await AsyncStorage.setItem(`${ASYNC_STORAGE_MESSAGES_KEY}_${idForApp}`, JSON.stringify(loadedMessages));
            console.log("手紙ボックスをサーバーからロードし、ローカルに保存しました。");
            loadedFromServer = true;
          } else {
            // サーバーからのレスポンスはあるがエラーだった場合 (404 Not Found など)
            console.warn(`サーバーからの手紙ボックス取得失敗: ${serverResponse.status}, URL: ${letterboxUrl}`);
            // この場合は、次にローカルストレージからの読み込みを試みる (loadedFromServer は false のまま)
          }
        } catch (networkError) {
          // fetch自体が失敗した場合 (ネットワーク接続なし、サーバーダウンなど)
          console.warn("サーバーからの手紙ボックス取得中にネットワークエラー:", networkError.message);
          // この場合も、次にローカルストレージからの読み込みを試みる (loadedFromServer は false のまま)
        }

        // (B) サーバーから取得できなかった場合、ローカルストレージから読み込む
        if (!loadedFromServer) {
          try {
            console.log("ローカルストレージから手紙ボックスのロードを試みます。");
            const storedMessagesJson = await AsyncStorage.getItem(`${ASYNC_STORAGE_MESSAGES_KEY}_${idForApp}`);
            if (storedMessagesJson !== null) {
              loadedMessages = JSON.parse(storedMessagesJson);
              console.log("ローカルストレージから手紙ボックスをロードしました。");
            } else {
              console.log("ローカルストレージにも手紙ボックスデータがありません。");
              // loadedMessages は空のまま (または initialMessagesData を使う)
            }
          } catch (asyncStorageError) {
            console.error("AsyncStorageからの手紙ボックスロードに失敗:", asyncStorageError);
            // loadedMessages は空のまま (または initialMessagesData を使う)
          }
        }
        
        // 最終的に取得できたメッセージをセット (何もなければ空配列か初期データ)
        if (loadedFromServer || (loadedMessages && loadedMessages.length > 0)) {
          setMessages(loadedMessages);
        } else {
          console.log("利用可能な手紙ボックスデータがないため、初期デモデータ（または空）を使用します。");
          setMessages(initialMessagesData); // initialMessagesDataが定義されていればそれを使う
        }
      } else {
        // 有効なuserIdがない、またはserverIPがない場合はデモデータを表示
        console.log("有効なuserIdまたはserverIPがないため、デモデータを使用します。");
        setMessages(initialMessagesData);
      }
      setIsLoadingMessages(false); // 手紙ボックスのローディング終了
      setIsLoadingApp(false); // 全ての初期化処理が終わったらローディング終了
    };

    initializeApp();
  }, [serverIP]); // Re-run if serverIP changes, userId is now set within this effect

  // --- 手紙受信・開封フロー用 ---
  const [arrivedBottle, setArrivedBottle] = useState(null); // ホームに表示する新しい瓶のデータ (1通)
  const arrivedBottleOpacityAnim = useRef(new Animated.Value(0)).current; // ホームの瓶のフェードイン用
  const [bottleOpeningOverlayVisible, setBottleOpeningOverlayVisible] = useState(false); // 瓶開封オーバーレイ表示用
  const largeBottleSlideAnimY = useRef(new Animated.Value(Dimensions.get('window').height)).current; // 大きな瓶のスライドイン用 (初期位置は画面下外)
  const [largeBottleTapCount, setLargeBottleTapCount] = useState(0); // 大きな瓶のタップ回数
  const [isUserInCooldown, setIsUserInCooldown] = useState(false);
  const [cooldownEndTime, setCooldownEndTime] = useState(0);

  // 手紙の受信
  const fetchNewLetterFromServer = async () => {
    if (!userId || !serverIP || arrivedBottle) { // arrivedBottle があれば、まだ処理していないので取得しない
      return;
    }

    try {
      const currentServerIP = tempIP || serverIP;
      const url = `${currentServerIP}/receive_unopened/${userId}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`手紙の受信エラー (${userId}): ${response.status}`);
        setIsUserInCooldown(false); // エラー時はクールダウン状態不明なので一旦解除
        return;
      }
      const data = await response.json();

      if (data && data.status === "new_letter_available" && data.id) {
        console.log('新しい手紙の通知を受信:', data.id, data.title);
        setArrivedBottle(data); // 届いた瓶の情報をセット (これがホーム画面の瓶になる)
        Animated.timing(arrivedBottleOpacityAnim, {
          toValue: 1,
          duration: 500, // 0.5秒でフェードイン
          useNativeDriver: true,
        }).start();
        setIsUserInCooldown(false);
        setCooldownEndTime(0);
      } else if (data && data.status === "cooldown") {
        console.log(`クールダウン中です。残り: ${data.cooldown_remaining_seconds}秒`);
        setIsUserInCooldown(true);
        setCooldownEndTime(Date.now() + data.cooldown_remaining_seconds * 1000);
      } else if (data && data.status === "no_new_letters") {
        // console.log(`新しい手紙はありませんでした (${userId})`);
        setIsUserInCooldown(false);
        setCooldownEndTime(0);
      } else {
        // サーバーからの予期せぬレスポンスや、stale_letter_removed の場合など
        setIsUserInCooldown(false);
      }
    } catch (error) {
      console.error(`手紙の受信に失敗しました (${userId}):`, error);
      setIsUserInCooldown(false);
    }
  };

  // ポーリング
  const POLLING_INTERVAL = 20000; // 20秒ごと (お好みで調整)
  useEffect(() => {
    if (userId && userId !== 'unknown-user' && userId !== '' && serverIP && !arrivedBottle) {
      console.log(`ポーリングを開始します (ユーザーID: ${userId})`);
      fetchNewLetterFromServer();
      const intervalId = setInterval(fetchNewLetterFromServer, POLLING_INTERVAL);
      return () => {
        console.log(`ポーリングを停止します (ユーザーID: ${userId})`);
        clearInterval(intervalId);
      };
    }
  }, [userId, serverIP]);

  // 新しく届いた瓶をホーム画面から開封する
  const [messageToOpenDetails, setMessageToOpenDetails] = useState(null);

  const handleOpenNewBottle = (bottleData) => {
    setMessageToOpenDetails(bottleData); // 開封対象のメッセージを保持 (既存のステートを活用)
    setLargeBottleTapCount(0);        // 大きな瓶のタップカウントをリセット

    // (A) ホーム画面の小さな瓶をフェードアウト
    Animated.timing(arrivedBottleOpacityAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // フェードアウト完了後にarrivedBottleをnullにしても良いが、
      // bottleOpeningOverlayVisibleがtrueになることで隠れるので、ここでは必須ではない。
      // ただし、オーバーレイを閉じたときに再表示させないためには、ここでnullにするか、
      // または開封処理完了時にnullにする。
      // setArrivedBottle(null); // ← ここで消すと、開封キャンセル時に戻せない
    });

    // (B) 瓶開封オーバーレイを表示し、大きな瓶をスライドイン
    setBottleOpeningOverlayVisible(true);
    Animated.timing(largeBottleSlideAnimY, {
      toValue: 0, // 画面中央（または目的のY座標）へ
      duration: 400, // スライドアニメーションの時間
      useNativeDriver: true,
      // easing: Easing.out(Easing.ease), // 好みでイージングを追加
    }).start();
  };

  // 執筆モード
  const [writingVisible, setWritingVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(800)).current; // 初期位置は画面外下部
  const fadeAnim = useRef(new Animated.Value(0)).current; // 透明度の初期値は0 (完全に透明)
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const systemMessageAnimY = useRef(new Animated.Value(-150)).current; // 初期位置は画面外上部 (-150など十分な値)
  const systemMessageOpacity = useRef(new Animated.Value(0)).current;  // 初期透明度は0

  useEffect(() => {
    let hideTimerId = null;

    if (statusMessage) { // このifブロックは「送信成功！」の時だけ実行される想定
      // (1) 表示アニメーションを開始
      Animated.parallel([
        Animated.timing(systemMessageAnimY, {
          toValue: Platform.OS === 'ios' ? 50 : 20,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(systemMessageOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        // (2) 表示アニメーションが完了した後、自動で隠すタイマーをセット
        hideTimerId = setTimeout(() => {
          // (3) 非表示アニメーションを開始
          Animated.parallel([
            Animated.timing(systemMessageAnimY, {
              toValue: -150,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(systemMessageOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            })
          ]).start(() => {
            // (4) 非表示アニメーション完了後に statusMessage を空にする
            setStatusMessage('');
          });
        }, 2500); // 表示アニメーション完了後から2.5秒後に隠す
      });
    } else {
      // statusMessageが空になったら、アニメーション値を即座に初期の「隠れた」状態に戻す
      systemMessageAnimY.setValue(-150);
      systemMessageOpacity.setValue(0);
    }

    // useEffectのクリーンアップ関数
    return () => {
      if (hideTimerId) {
        clearTimeout(hideTimerId);
      }
    };
  }, [statusMessage, systemMessageAnimY, systemMessageOpacity]);

  const sendMessage = async () => {
    if (isSending || !message.trim()) {
      if (!message.trim()) {
        Alert.alert('エラー', 'メッセージを入力してください');
      }
      return;
    }

    setIsSending(true);

    const messageTitleToSend = title.trim() === '' ? '無題のメッセージ' : title.trim();

    const currentServerIP = tempIP || serverIP;  // 念のため fallback もつける
    const url = `${currentServerIP}/send`;

    // タイムアウト処理の準備
    const controller = new AbortController();
    const timeoutDuration = 10000; // 10秒
    const timeoutId = setTimeout(() => {
      controller.abort(); // 10秒経過したらリクエストを中断
    }, timeoutDuration);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: messageTitleToSend, message }),
        signal: controller.signal, // AbortControllerのsignalを渡す
      });

      clearTimeout(timeoutId); // レスポンスが返ってきたらタイマーをクリア

      const data = await res.json();
      if (data.status === 'received_and_saved') {
        setStatusMessage('✅ 送信成功！');
        setMessage('');
        setTitle('');
        Animated.timing(slideAnim, {
          toValue: 800,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setWritingVisible(false));
      } else {
        Alert.alert('送信エラー', `メッセージの送信に失敗しました。(詳細: ${data.message || 'サーバーエラー'})`);
      }
    } catch (e) {
    clearTimeout(timeoutId);
      if (e.name === 'AbortError') { // 中断エラー（タイムアウト）かどうかを判定
        console.log('Fetch aborted due to timeout');
        Alert.alert('タイムアウト', 'しばらくしてから再度お試しください。');
      } else {
        console.error(e);
        Alert.alert('ネットワークエラー', 'ネットワークに接続できませんでした。接続を確認して再度お試しください。');
      }
    } finally {
      setIsSending(false);
    }
  };


  // 手紙ボックスのメッセージを日付順にソートして表示
  const displayMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    // date_received フィールドで新しいものが先頭に来るようにソート
    // date_received がない場合は、date や date_sent など、利用可能な日付フィールドを使う
    return [...messages].sort((a, b) => {
      const dateA = new Date(a.date_received || a.date || a.date_sent || 0);
      const dateB = new Date(b.date_received || b.date || b.date_sent || 0);
      return dateB - dateA; // 降順 (新しいものが先)
    });
    // .reverse() は不要になります、sortで直接降順にしているため
  }, [messages]);

  const itemsPerPage = 9; // 1ページあたりのアイテム数
  // ページ分割されたメッセージの配列 (例: [ [msg1-9], [msg10-18], ... ])
  const paginatedMessages = useMemo(() => {
    if (!displayMessages || displayMessages.length === 0) return []; // メッセージがない場合は空の配列
    const pages = [];
    for (let i = 0; i < displayMessages.length; i += itemsPerPage) {
      pages.push(displayMessages.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [displayMessages]);
  const totalPages = paginatedMessages.length;
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [shelfContainerWidth, setShelfContainerWidth] = useState(0); // 棚コンテナの実際の幅

  // settingsVisible が true になったときに tempPreferences を現在の preferences で初期化
  useEffect(() => {
    if (settingsVisible) {
      setTempIP(serverIP);
      setTempPreferences(preferences); // ★ 現在の設定を一時変数にコピー
    }
  }, [settingsVisible, userId, serverIP, preferences]); // 依存配列に preferences を追加

  const saveSettings = () => {
    setServerIP(tempIP);
    setPreferences(tempPreferences);
    setSettingsVisible(false);
    // TODO: 後で preferences をサーバーに送信する処理を追加
    console.log("保存された受信好み:", tempPreferences);

    setStatusMessage('✅ 設定を保存しました！');
    console.log("保存されたサーバーIP:", tempIP);
    console.log("保存された受信好み:", tempPreferences);
  };
  const cancelSettings = () => {
    setTempIP(serverIP); // 元の値に戻す
    setTempPreferences(preferences); // 元の値に戻す
    setSettingsVisible(false); // ステートは変更しない
  };

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1, // 透明度を1 (不透明) に
      duration: 300, // 0.3秒でアニメーション
      useNativeDriver: true, // パフォーマンス向上のため
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(fadeAnim, {
      toValue: 0, // 透明度を0 (透明) に
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setReadingMessage(null); // フェードアウト完了後にメッセージをクリア
    });
  };

  // FlatListのonViewableItemsChangedを使って、現在表示されているページのインデックスを更新
  const onViewRef = React.useRef(({ viewableItems }) => {
  if (viewableItems && viewableItems.length > 0) {
    // viewableItems[0].index が null や undefined になるケースを考慮
    setCurrentPageIndex(viewableItems[0].index ?? 0);
  }
  });
  const viewConfigRef = React.useRef({ viewAreaCoveragePercentThreshold: 50 });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {statusMessage ? (
        <Animated.View style={[
          styles.systemMessageContainer,
          {
            transform: [{ translateY: systemMessageAnimY }],
            opacity: systemMessageOpacity,
          }
        ]}>
          <Text style={styles.systemMessageText}>{statusMessage}</Text>
        </Animated.View>
      ) : null}

      <ImageBackground
        source={require('./assets/bg1.png')}
        style={styles.container}
        resizeMode="cover" // 画面比率を満たすように拡大。必要に応じて contain/stretch に
      >
        <View style={styles.container}>
          {/* 設定ボタン */}
          <View style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
            <TouchableOpacity onPress={() => setSettingsVisible(true)}>
              <Animated.Image
                source={require('./assets/setting-button.png')}
                style={[
                  { width: 80, height: 80 }, // 元のスタイル
                  { transform: [{ rotate: settingsButtonSpin }] } // ★ 回転アニメーションを適用
                ]}
              />
            </TouchableOpacity>
          </View>
          {/* 執筆ボタン */}
          <View style={{ position: 'absolute', bottom: 15, left: 15, zIndex: 10 }}>
            <TouchableOpacity onPress={() => {
              setWritingVisible(true);
              Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start();
            }}>
              <Image source={require('./assets/write-button.png')} style={{ width: 100, height: 100 }} />
            </TouchableOpacity>
          </View>

          {/* 手紙ボックスボタン */}
          <View style={{ position: 'absolute', bottom: 15, right: 15, zIndex: 10 }}>
            <TouchableOpacity onPress={() => setBoxVisible(true)}>
              <Image source={require('./assets/box-button.png')} style={{ width: 100, height: 100 }} />
            </TouchableOpacity>
          </View>

          {/* 新しく届いた瓶を表示する (1通のみ) */}
          {arrivedBottle && !bottleOpeningOverlayVisible && !readingMessage && (
            <Animated.View style={[
              styles.newBottlesArea, // このスタイルは瓶を配置するエリア全体を指す
              { opacity: arrivedBottleOpacityAnim }
            ]}>
              <TouchableOpacity
                style={styles.newBottleOnScreen} // 個々の瓶のスタイル
                onPress={() => handleOpenNewBottle(arrivedBottle)}
              >
                <Image source={require('./assets/bottle.png')} style={styles.newBottleImage}/>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* 設定モーダル */}
          <Modal visible={settingsVisible} animationType="slide" transparent={true}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.overlay}>
                <View style={styles.settingsModalContent}>
                  <Text style={styles.settingTitle}>設定</Text>

                  {/* --- ユーザーID (表示のみ) --- */}
                  <Text style={styles.settingLabel}>ユーザーID:</Text>
                  <Text style={[styles.settingLabel, {color: "rgb(46, 85, 122)"}]}>{userId}</Text>

                  {/* --- サーバーIPアドレス --- */}
                  <Text style={styles.settingLabel}>サーバーアドレス:</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="サーバーIPアドレス"
                    value={tempIP}
                    onChangeText={setTempIP}
                  />

                  {/* --- 受信好み設定 (新規追加) --- */}
                  <Text style={styles.settingLabel}>受信好み設定 (任意):</Text>
                  <TextInput
                    style={styles.modalInput} // ★ 複数行用スタイルを追加
                    placeholder="例: 明るい話題、短い手紙が好き。詩や物語も歓迎...（100文字まで）"
                    value={tempPreferences} // ★ 新しいステート変数 (下記参照)
                    onChangeText={setTempPreferences} // ★ 新しいステート更新関数 (下記参照)
                    multiline={true}
                    numberOfLines={3} // 初期表示の行数（実際の表示は内容による）
                    maxLength={100} // 最大100文字
                    textAlignVertical="top" // Androidで複数行入力のカーソル位置を上にする
                  />

                  {/* --- 保存ボタンとキャンセルボタン --- */}
                  <View style={styles.buttonRowContainer}>
                    <Pressable style={styles.buttonInRow} onPress={saveSettings}>
                      <Text style={styles.buttonText}>保存</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.buttonInRow, { backgroundColor: '#AAA' }]}
                      onPress={cancelSettings}
                    >
                      <Text style={styles.buttonText}>キャンセル</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* 執筆モーダル */}
          <Modal visible={writingVisible} animationType="slide" transparent={true}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={60}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                  <ScrollView
                    contentContainerStyle={{ 
                      flexGrow: 1,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <Animated.View style={{ width: actualStationeryWidth, alignItems: 'center', transform: [{ translateY: slideAnim }] }}>
                      <View style={{width: '100%', height: actualStationeryHeight}}>
                        <ImageBackground source={require('./assets/letter.png')} style={styles.letterNote} resizeMode="stretch">
                          {/* 入力エリア */}
                          <View style={{ flex: 1 }}>
                            {/* タイトル入力欄 */}
                            <TextInput
                              style={styles.titleInput}
                              placeholder="タイトルを入力 (任意)" // 未入力でも送信可能なので「任意」と示す
                              value={title}
                              onChangeText={setTitle}
                              returnKeyType="next" // 次の入力欄へフォーカスを移すため（本文入力欄で対応が必要な場合あり）
                              maxLength={50} // 例えば最大50文字など
                            />

                            {/* 本文入力欄 */}
                            <TextInput
                              style={styles.letterInput} // このスタイルに flex: 1 を持たせる
                              multiline
                              placeholder="ここにメッセージを入力"
                              value={message}
                              onChangeText={setMessage}
                            />
                          </View>
                        </ImageBackground>
                      </View>

                      {/* ボタンエリア */}
                      <View style={styles.buttonRowContainer}>
                        <Pressable
                          onPress={sendMessage}
                          style={isSending ? [styles.buttonInRow, { backgroundColor: '#175C94' }] : styles.buttonInRow}
                          disabled={isSending} // 送信中はボタンを無効化
                        >
                          <Text style={styles.buttonText}>{isSending ? '送信中…' : '送信する'}</Text>
                        </Pressable>
                        <Pressable onPress={() => {
                          Animated.timing(slideAnim, {
                            toValue: 800,
                            duration: 300,
                            useNativeDriver: true,
                          }).start(() => setWritingVisible(false));
                        }} style={[styles.buttonInRow, { backgroundColor: '#AAA' }]}>
                          <Text style={styles.buttonText}>キャンセル</Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Modal>

          {/* 手紙ボックスモーダル */}
          <Modal visible={boxVisible} animationType="slide" transparent={true}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ImageBackground
                source={require('./assets/shelf.png')}
                style={styles.shelfBackground}
                resizeMode="contain"
                onLayout={(event) => { // ImageBackgroundの実際の幅を取得してステートに保存
                  const { width } = event.nativeEvent.layout;
                  setShelfContainerWidth(width);
                }}
              >
                {/* ローディング表示 */}
                {isLoadingMessages ? (
                  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                ) : shelfContainerWidth > 0 && paginatedMessages.length > 0 && (
                  <FlatList // 手紙ボックスのメッセージをページごとに表示
                    data={paginatedMessages}
                    renderItem={({ item: pageMessages, index }) => (
                      // 各ページコンテナ。幅を親のImageBackgroundに合わせる
                      <View style={[styles.shelfPage, { width: shelfContainerWidth }]}>
                        <View style={styles.shelfGrid}>
                          {pageMessages.map((msg) => (
                            <TouchableOpacity
                              key={msg.id}
                              style={styles.bottleItemOnShelf}
                              activeOpacity={0.7}
                              onPress={() => {
                                setReadingMessage({...msg, isReceivedMessage: false });
                                setBoxVisible(false);
                                fadeAnim.setValue(0); // フェードインのために透明度をリセット
                                fadeIn(); // 手紙を読むときにフェードイン
                              }}
                            >
                              <Image source={require('./assets/bottle.png')} style={styles.bottleImageOnShelf} />
                              <Text numberOfLines={1} style={styles.bottleLabel}>{msg.title}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                    keyExtractor={(item, index) => `page-${index}`}
                    horizontal // 横スクロールにする
                    pagingEnabled // スワイプでページ単位にスクロールする
                    showsHorizontalScrollIndicator={false} // 横スクロールバーを非表示
                    onViewableItemsChanged={onViewRef.current} // 表示されてるアイテムが変わった時の処理
                    viewabilityConfig={viewConfigRef.current} // 表示されてるアイテムを判定する設定
                    // getItemLayout を使うとパフォーマンスが向上する場合があります（ページ幅が全て同じなので有効）
                    getItemLayout={(data, index) => (
                      { length: shelfContainerWidth, offset: shelfContainerWidth * index, index }
                    )}
                  />
                )}

                {/* メッセージが1件もない場合の表示 (任意) */}
                {shelfContainerWidth > 0 && paginatedMessages.length === 0 && (
                  <View style={{ width: actualShelfDisplayWidth, justifyContent: 'center', alignItems: 'center', marginTop: '50%' }}>
                      <Text style={styles.emptyShelfText}>まだ手紙がないみたい…</Text>
                  </View>
                )}

                {/* ページ番号表示 (FlatListの兄弟要素として配置) */}
                {totalPages > 0 && ( // メッセージがある場合のみページ番号を表示
                    <View style={styles.pageIndicatorContainer}>
                      <Text style={styles.pageIndicatorText}>
                        {currentPageIndex + 1} / {totalPages}
                      </Text>
                    </View>
                )}

                <TouchableOpacity
                  onPress={() => setBoxVisible(false)}
                  style={[styles.button, { backgroundColor: '#AAA', position: 'absolute', bottom:-55 }]}
                >
                  <Text style={styles.buttonText}>閉じる</Text>
                </TouchableOpacity>
              </ImageBackground>
            </View>
          </Modal>

          {/* 手紙の内容を表示するモーダル (カスタム View で) */}
          {!!readingMessage && (
            <Animated.View style={[
              styles.overlay, // 新しいスタイル (下記参照)
              { opacity: fadeAnim } // 手紙を読むモーダル専用のアニメーション値
            ]}>
               <ScrollView
                contentContainerStyle={{ 
                  flexGrow: 1,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={{ width: actualStationeryWidth, alignItems: 'center' }}>
                  <View style={{ width: "100%", height: actualStationeryHeight }}>
                    <ImageBackground
                      source={require('./assets/letter.png')}
                      style={styles.letterNote} // flex: 1 と適切なpaddingを持つスタイル
                      resizeMode="stretch"
                    >
                      <ScrollView style={styles.letterContentArea}>
                        <Text style={[styles.titleInput, { paddingBottom: 9 }]}>
                          {readingMessage?.title}
                        </Text>
                        <Text style={styles.letterInput}>
                          {readingMessage?.content}
                        </Text>
                      </ScrollView>
                    </ImageBackground>
                  </View>

                  <View style={styles.buttonRowContainer}>
                    <Pressable
                      style={[styles.button, { backgroundColor: '#AAA' }]} // 以前定義したボタン共通スタイルをベースに
                      onPress={async () => {
                        const currentMessage = readingMessage;
                        if (readingMessage?.isReceivedMessage && readingMessage.id) {
                          // 新しく受信した手紙の場合の処理
                          try {
                            const currentServerIP = tempIP || serverIP;
                            const url = `${currentServerIP}/mark_letter_opened/${userId}/${readingMessage.id}`;
                            console.log(`開封マークAPI URL: ${url}`);
                            const response = await fetch(url, {
                              method: 'POST',
                            });
                            if (!response.ok) {
                              throw new Error(`開封マークAPIエラー: ${response.status}`);
                            }
                            const result = await response.json();
                            if (result.status === "marked_opened_and_in_received" || result.status === "already_in_received") {
                              console.log(`手紙 ${readingMessage.id} を開封済みとしてサーバーに通知しました。`);
                              setMessages(prevMessages => {
                                if (!prevMessages.find(m => m.id === result.letter.id)) {
                                  // サーバーから返されたフォーマットをそのまま使う
                                  // dateフィールド名がクライアントのmessagesステートと一致しているか確認
                                  // サーバーが返す `result.letter` が `id, title, content, date_received` を持つ想定
                                  const newLetterForBox = {
                                      id: result.letter.id,
                                      title: result.letter.title,
                                      content: result.letter.content,
                                      date_received: result.letter.date_received,
                                  };
                                  const updatedMessages = [...prevMessages, newLetterForBox];
                                  // AsyncStorageへの保存は専用のuseEffectに任せるか、ここで明示的に行う
                                  AsyncStorage.setItem(`${ASYNC_STORAGE_MESSAGES_KEY}_${userId}`, JSON.stringify(updatedMessages))
                                      .catch(e => console.error("手紙ボックスへの追加保存失敗:", e));
                                }
                              });
                              fadeOut();
                            } else {
                              Alert.alert("エラー", "手紙の開封状態の更新に失敗しました。");
                            }
                          } catch (e) {
                            console.error("開封マークAPI呼び出しエラー:", e);
                            Alert.alert("通信エラー", "手紙の開封状態を更新できませんでした。");
                          }
                        } else if (!readingMessage?.isReceivedMessage) {
                          fadeOut();
                          setBoxVisible(true); // 自分の手紙棚を再表示
                        }
                      }}
                    >
                      <Text style={styles.buttonText}>{readingMessage?.isReceivedMessage ? '手紙ボックスに入れる' : '瓶に戻す'}</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </ImageBackground>

      {/* 瓶を開ける画面 (オーバーレイと大きな瓶) */}
      {bottleOpeningOverlayVisible && (
        <View style={styles.overlay}>
          <Animated.View style={[
            styles.largeBottleContainer, // 大きな瓶のコンテナスタイル
            { transform: [{ translateY: largeBottleSlideAnimY }] }
          ]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                const newTapCount = largeBottleTapCount + 1;
                setLargeBottleTapCount(newTapCount);
                if (newTapCount >= 3) { // 3回タップで開封
                  // 大きな瓶をスライドアウトさせる (任意)
                  Animated.timing(largeBottleSlideAnimY, {
                    toValue: Dimensions.get('window').height, // 画面下にスライドアウト
                    duration: 300,
                    useNativeDriver: true,
                  }).start(() => {
                    setBottleOpeningOverlayVisible(false); // オーバーレイを閉じる
                  });

                  // 手紙を読むモーダルを表示する準備
                  setReadingMessage({
                    ...messageToOpenDetails, // 開封対象のメッセージ情報
                    isReceivedMessage: true,  // 受信した手紙であることを示すフラグ
                  });
                  fadeAnim.setValue(0); // 手紙を読むモーダルのアニメーション値をリセット
                  fadeIn();             // 手紙を読むモーダルをフェードイン (既存の関数)

                  // ホーム画面の arrivedBottle をクリア (ここで処理するのが確実)
                  setArrivedBottle(null);
                  // arrivedBottleOpacityAnim もリセット
                  arrivedBottleOpacityAnim.setValue(0);
                }
              }}
            >
              <Image source={require('./assets/bottle.png')} style={styles.largeBottleImage_opening} />
            </TouchableOpacity>
            <Text style={styles.tapPromptText_opening}>
              {largeBottleTapCount < 3 ? `タップ (${largeBottleTapCount}/3)` : '開封中...'}
            </Text>
          </Animated.View>
          {/* この開封オーバーレイを閉じる「キャンセル」ボタンも必要なら追加 */}
          {/* <Pressable onPress={() => { ... (開封キャンセル処理) ... }} style={styles.cancelOpenBottleButton}>
              <Text style={styles.buttonText}>キャンセル</Text>
          </Pressable> */}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },

  // 設定モーダル
  settingTitle: {
    fontSize: 24,
    marginBottom: 12,
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'bold'
  },
  settingsModalContent: { // ★ 設定モーダルのメインコンテンツコンテナ
    width: '85%',
    backgroundColor: 'rgb(75, 184, 224)', // 少し明るい半透明の青など
    padding: 20,
    borderRadius: 10,
    elevation: 5, // Androidの影
    shadowColor: '#000', // iOSの影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  settingLabel: { // 各設定項目のラベル用スタイル
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  modalInput: {
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
  },

  // ボタンのスタイル
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    height: 45,
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonRowContainer: { // ボタンを横並びにするためのコンテナ
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  buttonInRow: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    height: 45,
    flex: 1,               // 横並びの場合、スペースを分け合う
    marginHorizontal: 8,   // ボタン間の左右マージン
    marginVertical: 0,     // コンテナでマージンを制御するので個別には不要に
  },

  // 執筆モードのスタイル
  letterNote: { // ImageBackground (便箋画像) のスタイル
    flex: 1,
    // 便箋画像の端から実際の書き込み開始位置までの「余白」
    // これらの値は、お持ちの letter.png のデザインに合わせて調整してください。
    // 例えば、画像の上端から10%の位置から書き始める、など。
    // 固定値(dp)で指定するか、actualStationeryHeight/Widthに基づいて計算します。
    paddingTop: actualStationeryHeight * 0.1,    // 例: 便箋の高さの10%
    paddingHorizontal: actualStationeryWidth * 0.08, // 例: 便箋の幅の8%
    paddingBottom: actualStationeryHeight * 0.08, // 例: 便箋の高さの8%
  },
  titleInput: { // タイトル入力欄のスタイル
    borderColor: '#ccc',
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,    // タイトル入力欄と本文入力欄の間
  },
  letterInput: {
    paddingHorizontal: 8,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 28,
  },
  // 手紙ボックスのスタイル
  shelfBackground: {
    width: actualShelfDisplayWidth,
    height: actualShelfDisplayHeight,  // または '80%' などでも可
    zIndex: 10, 
    // backgroundColor: 'rgba(0,255,0,0.5)', // 半透明の背景色
  },
  shelfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', // 左詰めにする (または 'space-between' や 'center' でアイテムを中央寄せ)
    width: '85%', // shelfBackground の幅に対して、グリッドが占める幅 (例: 85%)
                  // この幅の中に3つの瓶がきれいに収まるように調整します
    // backgroundColor: 'rgba(255,0,0,0.2)', // デバッグ用に背景色をつけて確認すると良い
  },
  bottleItemOnShelf: { // 瓶のTouchableOpacity用のスタイル
    // (shelfGridの幅) / 3 から、左右のマージンを引いた値が目安
    width: '30%',     // shelfGridの幅に対して30% (3つ並べるので約33.3%からマージン分を引く)
    height: '30%',
    aspectRatio: 0.8536, // 瓶の縦横比 (例: 幅70, 高さ100なら 70/100 = 0.7)
    alignItems: 'center',
    justifyContent: 'center', // 瓶画像とラベルをコンテナ内で中央に
    marginHorizontal: '1.5%', // 瓶同士の左右の間隔 (30% * 3 + 1.5% * 6 = 99%)
    marginVertical: '1.5%', // 瓶同士の左右の間隔 (30% * 3 + 1.5% * 6 = 99%)
  },
  bottleImageOnShelf: { // 瓶のImageコンポーネント用のスタイル
    width: '75%',  // bottleItemOnShelfの幅に対して80%
    height: '75%', // bottleItemOnShelfの高さに対して70% (aspectRatioで調整)
    resizeMode: 'contain',
  },
  bottleLabel: {
    marginTop: '3%',
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    width: '100%',
  },

  // 手紙の棚ページのスタイル
  shelfPage: {
    // width は FlatList の renderItem 内で動的に設定されます (例: { width: shelfContainerWidth })
    height: '100%',           // 親のImageBackgroundの高さに合わせる
    justifyContent: 'flex-start', // グリッドをページの上端から配置する
    alignItems: 'center',         // グリッド自体をページ内で水平中央に配置
    paddingTop: '9%',               // 棚の画像の上端から最初の瓶までの余白 (お好みで調整)
    paddingBottom: '6%',            // 棚の画像の下端と最後の瓶またはページインジケータとの余白 (お好みで調整)
    // backgroundColor: 'rgba(0,0,255,0.1)', // デバッグ用に一時的に背景色をつけると分かりやすい
  },
  pageIndicatorContainer: {
    position: 'absolute', // 棚画像の上に重ねて表示
    bottom: '2.5%', // 閉じるボタンとの兼ね合いで調整 (棚の下部からの位置)
    // left: 0, right: 0, // 横方向中央にしたい場合
    alignSelf: 'center', // これで横方向中央に
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyShelfText: { // メッセージがない場合のテキストスタイル
    color: '#fff', // 棚の背景に合わせて調整
    fontSize: 18,
    fontWeight: 'bold',
  },

  // 送信状態のメッセージ表示用スタイル
  systemMessageContainer: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: Dimensions.get('window').width - 40,
    top: 0, // translateYで初期位置は画面外になるので、top:0 でOK
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // 白くて半透明
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999, // 最前面に表示
    elevation: 10, // Androidの影
    shadowColor: '#000', // iOSの影
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  systemMessageText: {
    fontSize: 15,
    color: '#222', // 少し濃いめの文字色
    textAlign: 'center',
    fontWeight: '500',
  },
  newBottlesArea: { // 新しい瓶をまとめて表示するエリアのスタイル
    position: 'absolute',
    bottom: 100, // 例: メイン操作ボタン群の上あたり
    left: 10,
    right: 10,
    flexDirection: 'row', // 横に並べる場合
    flexWrap: 'wrap',     // 折り返す場合
    justifyContent: 'center', // 中央寄せ
    alignItems: 'flex-end',
    // height: 80, // 高さを指定する場合
    // backgroundColor: 'rgba(0,255,0,0.1)', // デバッグ用
  },
  newBottleOnScreen: { // 個々の新しい瓶のスタイル (TouchableOpacity)
    marginHorizontal: 5, // 瓶同士の間隔
    padding: 5,
    // position: 'absolute' は、bottle.positionStyle を使う場合に有効
  },
  newBottleImage: {
    width: 90,  // 新しい瓶の画像のサイズ (調整してください)
    height: 130, // 新しい瓶の画像のサイズ (調整してください)
    resizeMode: 'contain',
  },
  largeBottleContainer: { // スライドインする大きな瓶のコンテナ
    alignItems: 'center',
    // backgroundColor: 'white', // デバッグ用
  },
  largeBottleImage_opening: {
    width: 180, // 大きな瓶の表示サイズ (調整)
    height: 300, // 大きな瓶の表示サイズ (調整)
    resizeMode: 'contain',
  },
  tapPromptText_opening: {
    color: 'white',
    fontSize: 16,
    marginTop: 15,
    fontWeight: 'bold',
  },
});
