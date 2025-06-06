import React, { useState, useRef, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, TextInput, Alert, StyleSheet, SafeAreaView, Platform, 
  TouchableWithoutFeedback, Keyboard, Modal, Text, Pressable, Image, ImageBackground, FlatList,
  Animated, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Audio, Video, ResizeMode } from 'expo-av'; 
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';

import EmotionWheel from './EmotionWheel';
import initialMessagesData from './data/messages.json';
import styles, { actualStationeryWidth, actualStationeryHeight, actualShelfDisplayWidth, actualShelfDisplayHeight } from './styles';

const ASYNC_STORAGE_MESSAGES_KEY = '@MyApp:messages';
const ASYNC_STORAGE_PREFERENCES_KEY = '@MyApp:userPreferences';

export default function App() {
  const [emotionModalVisible, setEmotionModalVisible] = useState(false); // 感情選択モーダルの表示状態

  // Sound
  const [bgmSound, setBgmSound] = useState(); // 背景の音
  const soundEffectsRef = useRef({}).current; // 効果音の参照をまとめて保持するオブジェクト
  const [soundsLoaded, setSoundsLoaded] = useState(false);
  
  useEffect(() => {
    const loadSounds = async () => {
      // オーディオセッションの設定 (iOSでサイレントモードでも音を鳴らすため)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false, // 他の音を少し下げるか
        playThroughEarpieceAndroid: false,
      });

      console.log('サウンドをロード中...');
      try {
        // BGMのロードとループ再生設定
        const { sound: loadedBgm } = await Audio.Sound.createAsync(
           require('./assets/sounds/beach.mp3'), // ★ BGMファイルへのパス
           { isLooping: true, volume: 0.3 } // ★ isLooping: true と音量調整
        );
        setBgmSound(loadedBgm);
        console.log('BGMロード完了。');
        await loadedBgm.playAsync(); // BGMの再生開始
        console.log('BGM再生開始。');

        // 効果音のロード
        console.log('効果音をロード中...');
        try {
          // --- ボトル関連の音 ---
          const bottleArriveSound = new Audio.Sound();
          await bottleArriveSound.loadAsync(require('./assets/sounds/bottle_arrive.mp3'), { volume: 0.7 });
          soundEffectsRef['bottleArrive'] = bottleArriveSound; // 'bottle_arrive' という名前で登録

          const bottlePopSound = new Audio.Sound();
          await bottlePopSound.loadAsync(require('./assets/sounds/bottle_pop.mp3'), { volume: 1.0 });
          soundEffectsRef['bottlePop'] = bottlePopSound; // 'bottle_pop' という名前で登録

          const bottleTapSound = new Audio.Sound();
          await bottleTapSound.loadAsync(require('./assets/sounds/bottle_tap.mp3'), { volume: 0.9, isPitched: true });
          soundEffectsRef['bottleTap'] = bottleTapSound; // 'bottle_tap' という名前で登録

          const bottleOpenSound = new Audio.Sound();
          await bottleOpenSound.loadAsync(require('./assets/sounds/bottle_open.mp3'), { volume: 0.7 });
          soundEffectsRef['bottleOpen'] = bottleOpenSound; // 'bottleOpen' という名前で登録

          // --- 執筆モーダルの音 ---
          const writingSound = new Audio.Sound();
          await writingSound.loadAsync(require('./assets/sounds/writing.mp3'), { volume: 0.5 });
          soundEffectsRef['writing'] = writingSound; // 'writing' という名前で登録

          const sendSound = new Audio.Sound();
          await sendSound.loadAsync(require('./assets/sounds/send.mp3'), { volume: 0.8 });
          soundEffectsRef['send'] = sendSound; // 'send' という名前で登録

          const paperSound = new Audio.Sound();
          await paperSound.loadAsync(require('./assets/sounds/paper.mp3'), { volume: 0.9 });
          soundEffectsRef['paper'] = paperSound; // 'paper' という名前で登録

          // --- 設定モーダルの音 ---
          const settingOpenSound = new Audio.Sound();
          await settingOpenSound.loadAsync(require('./assets/sounds/setting_open.mp3'), { volume: 0.7 });
          soundEffectsRef['settingOpen'] = settingOpenSound; // 'settingOpen' という名前で登録

          const settingCloseSound = new Audio.Sound();
          await settingCloseSound.loadAsync(require('./assets/sounds/setting_close.mp3'), { volume: 0.7 });
          soundEffectsRef['settingClose'] = settingCloseSound;

          // --- 手紙ボックスの音 ---
          const boxOpenSound = new Audio.Sound();
          await boxOpenSound.loadAsync(require('./assets/sounds/box_open.mp3'), { volume: 0.7 });
          soundEffectsRef['boxOpen'] = boxOpenSound;

          const boxCloseSound = new Audio.Sound();
          await boxCloseSound.loadAsync(require('./assets/sounds/box_close.mp3'), { volume: 0.8 });
          soundEffectsRef['boxClose'] = boxCloseSound;

          console.log('効果音のロード完了。');
          setSoundsLoaded(true);

        } catch (error) {
          console.error("効果音のロードに失敗しました:", error);
        }

      } catch (error) {
        console.error("サウンドのロードに失敗しました:", error);
      }
    };

    loadSounds();

    // クリーンアップ関数: コンポーネントがアンマウントされるときにサウンドをアンロード
    return () => {
      console.log('サウンドをアンロード中...');
      if (bgmSound) {
        bgmSound.unloadAsync();
      }
      // soundEffectsRef の中のサウンドを全てアンロード
      Object.values(soundEffectsRef).forEach(sound => {
        if (sound) {
          sound.unloadAsync();
        }
      });
    };
  }, []);

  const playSoundEffect = async (soundName, rate = 1.0) => {
    const soundObject = soundEffectsRef[soundName];
    if (soundObject) {
      try {
        // 現在再生中の音があれば即座に停止させる
        await soundObject.stopAsync();
        await soundObject.replayAsync({
          rate,
          shouldCorrectPitch: false,
        });
      } catch (e) {
        console.log(`効果音 '${soundName}' の再生に失敗:`, e);
      }
    } else {
      console.warn(`効果音 '${soundName}' はロードされていません。`);
    }
  };

  // 設定
  const [settingsVisible, setSettingsVisible] = useState(false);
  const settingsButtonRotateAnim = useRef(new Animated.Value(0)).current; // 0: 0度, 1: 180度 を表現
  const [userId, setUserId] = useState("unknown-user"); // 初期値は適当な文字列
  const [tempUserId, setTempUserId] = useState(userId);
  const [serverIP, setServerIP] = useState('http://192.168.3.7:8000'); // デフォルト値
  const [tempIP, setTempIP] = useState(serverIP);
  const [preferences, setPreferences] = useState({ emotion: "", custom: "" });
  const [tempEmotion, setTempEmotion] = useState(preferences.emotion);
  const [tempCustom, setTempCustom] = useState(preferences); // 設定モーダル内の一時的な値

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

      // 画像アセットのプリロード処理
      try {
        console.log("画像アセットのプリロードを開始します...");
        const imagesToCache = [
          require('./assets/shelf.png'),
          require('./assets/letter.png'),
          require('./assets/bottle.png'),
          require('./assets/box-button.png'),
          require('./assets/setting-button.png'),
          require('./assets/write-button.png'),
        ];

        const cacheImages = imagesToCache.map(image => {
          return Asset.fromModule(image).downloadAsync();
        });
        
        await Promise.all(cacheImages); // 全ての画像のダウンロード（キャッシュ）を待つ
        console.log("画像アセットのプリロードが完了しました！");
      } catch (e) {
        console.warn("画像アセットのプリロードに失敗しました:", e);
      }

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

      // 2. ユーザーIDと設定をサーバーで確認
      if (idForApp && !idForApp.startsWith('user-fallback') && !idForApp.startsWith('user-error') && serverIP) {
        let initialUserPreferences = { emotion: "", custom: "" }; // デフォルト値
        // まずローカルストレージ (AsyncStorage) から設定を読み込んでUIに反映
        try {
          const storedPrefsJson = await AsyncStorage.getItem(`${ASYNC_STORAGE_PREFERENCES_KEY}_${idForApp}`);
          if (storedPrefsJson) {
            const parsedPrefs = JSON.parse(storedPrefsJson);
            // 取得した値がオブジェクトであり、期待するキーを持っているか確認するとより安全
            if (typeof parsedPrefs === 'object' && parsedPrefs !== null) {
              initialUserPreferences = {
                  emotion: parsedPrefs.emotion || "", // フォールバック
                  custom: parsedPrefs.custom || ""   // フォールバック
              };
              console.log("ローカルストレージから受信好み設定をロード:", initialUserPreferences);
            } else {
              console.warn("ローカルストレージのpreferencesが期待する形式ではありませんでした。");
              // initialUserPreferences はデフォルト値のまま
            }
          } else {
            console.log("ローカルストレージに受信好み設定がありません。");
            // initialUserPreferences はデフォルト値のまま
          }
        } catch (e) {
          console.error("AsyncStorageからの受信好み設定ロードに失敗:", e);
          // initialUserPreferences はデフォルト値のまま
        }
        setPreferences(initialUserPreferences);

        try {
          const response = await fetch(`${serverIP}/check_user/${idForApp}`, { method: 'POST' }); // Ensure this matches server endpoint
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          const userDataFromServer = await response.json(); // サーバーからのユーザー詳細情報
          setIsNewUser(userDataFromServer.is_new_user);
          console.log(`User status for ${idForApp}: New user = ${userDataFromServer.is_new_user}`);

          if (userDataFromServer.details && userDataFromServer.details.preferences) {
            const serverPrefs = {
                emotion: userDataFromServer.details.preferences.emotion || "",
                custom: userDataFromServer.details.preferences.custom || ""
            };
            setPreferences(serverPrefs); // ★ サーバーデータでUIを上書き更新

            await AsyncStorage.setItem(`<span class="math-inline">\{ASYNC\_STORAGE\_PREFERENCES\_KEY\}\_</span>{idForApp}`, JSON.stringify(serverPrefs));
            console.log("サーバーから受信好み設定をロード:", initialUserPreferences);
          } else {
            console.log("サーバーのユーザー情報にpreferencesがありません。");
            // ローカルにもサーバーにもない新規ユーザーの場合、デフォルト値をローカルに保存
            if (currentPreferences.emotion === "" && currentPreferences.custom === "" && !(await AsyncStorage.getItem(`<span class="math-inline">\{ASYNC\_STORAGE\_PREFERENCES\_KEY\}\_</span>{idForApp}`))) {
                await AsyncStorage.setItem(`<span class="math-inline">\{ASYNC\_STORAGE\_PREFERENCES\_KEY\}\_</span>{idForApp}`, JSON.stringify(currentPreferences));
            }
          }
          // --- チュートリアル用に手紙一枚書かせる ---
          // if (data.is_new_user) {
          //   // TODO: Trigger tutorial flow
          //   Alert.alert("ようこそ！", "ボトルメッセージへようこそ。最初に手紙を書いてみましょう。");
          //   // For now, maybe open writing modal directly for new user after a slight delay or a welcome screen
          //   // setWritingVisible(true); // Example: Open writing modal for tutorial
          // }
        } catch (e) {
          console.error("ユーザー確認またはサーバーからの設定ロード失敗:", e);
          Alert.alert("サーバー接続エラー", "ユーザー情報の確認に失敗しました。ネットワーク接続を確認してください。");

          setIsNewUser(null); // Set to undecided or handle as error
        }

        // 3. 手紙ボックスの内容をロード (userIdが確定し、フォールバック/エラーIDでない場合)
        setIsLoadingMessages(true); // 手紙ボックスのローディング開始
        let localMessagesLoaded = false;

        // (A) まずローカルストレージ (AsyncStorage) から手紙を読み込んで表示
        try {
          const storedMessagesJson = await AsyncStorage.getItem(`${ASYNC_STORAGE_MESSAGES_KEY}_${idForApp}`);
          if (storedMessagesJson !== null) {
            const messagesFromStorage = JSON.parse(storedMessagesJson);
            setMessages(messagesFromStorage); // ★ まずローカルデータでUIを更新
            localMessagesLoaded = true;
            console.log("手紙ボックスをローカルストレージからロードしました。");
          } else {
            console.log("ローカルストレージに手紙ボックスデータがありません。");
            // ローカルにない場合は、一旦空か初期デモデータでUIを更新しておく (サーバー取得待ち)
            setMessages(initialMessagesData); // または []
          }
        } catch (asyncStorageError) {
          console.error("AsyncStorageからの手紙ボックスロードに失敗:", asyncStorageError);
          setMessages(initialMessagesData); // エラー時もフォールバック (または [])
        }

        // (B) 次に、サーバーから最新の手紙リストを取得し、ローカルを更新 (バックグラウンド同期)
        // この処理はローカルデータの表示後に行われるため、ユーザーはすぐにデータを見れる
        try {
          const letterboxUrl = `${serverIP}/letterbox/${idForApp}`;
          console.log("サーバーと手紙ボックスの同期を開始します:", letterboxUrl);
          const serverResponse = await fetch(letterboxUrl);

          if (serverResponse.ok) {
            const serverData = await serverResponse.json();
            // ★ サーバーからのデータで messages ステートと AsyncStorage を更新
            setMessages(serverData);
            await AsyncStorage.setItem(`${ASYNC_STORAGE_MESSAGES_KEY}_${idForApp}`, JSON.stringify(serverData));
            console.log("手紙ボックスをサーバーと同期し、ローカルを更新しました。");
          } else {
            // サーバーからのレスポンスはあるがエラーだった場合
            console.warn(`サーバーとの手紙ボックス同期失敗: ${serverResponse.status}, URL: ${letterboxUrl}`);
            // この場合、ローカルデータがそのまま使われ続ける (もしあれば)
            // 必要であればユーザーに通知「最新情報が取得できませんでした」など
            if (!localMessagesLoaded) { // サーバーも失敗、ローカルもなかった場合
              Alert.alert("データ取得エラー", "手紙ボックスの情報を取得できませんでした。");
            }
          }
        } catch (networkError) {
          // fetch自体が失敗した場合 (ネットワーク接続なし、サーバーダウンなど)
          console.warn("サーバーとの手紙ボックス同期中にネットワークエラー:", networkError.message);
          if (!localMessagesLoaded) { // サーバーも失敗、ローカルもなかった場合
              Alert.alert("通信エラー", "手紙ボックスの情報を取得できませんでした。ネットワークを確認してください。");
          }
          // この場合も、ローカルデータがそのまま使われ続ける (もしあれば)
        }
        setIsLoadingMessages(false); // ★ 手紙ボックス関連のローディング終了
      } else {
        // 有効なユーザーIDがない、またはserverIPがない場合は、初期デモデータを表示
        console.log("有効なユーザーIDまたはserverIPがないため、手紙ボックスは初期デモデータを使用します。");
        setMessages(initialMessagesData);
        setIsLoadingMessages(false); // この場合もローディングは終了
      }

      setIsLoadingApp(false); // 全ての初期化処理が終わったらローディング終了
      setEmotionModalVisible(true);
    };

    initializeApp();
  }, [serverIP]); // Re-run if serverIP changes, userId is now set within this effect

  // --- 感情選択モーダルのハンドラー ---
  const handleEmotionSelect = async (selectedEmotion) => {
    console.log("選択された感情:", selectedEmotion);
    setEmotionModalVisible(false); // まずポップアップを閉じる

    // 1. Reactのステートを更新
    const updatedPreferencesObject = {
      ...preferences, // 既存の custom 設定などを保持
      emotion: selectedEmotion,
    };
    setPreferences(updatedPreferencesObject);

    // 2. サーバーに設定を送信
    // (saveSettings関数とほぼ同じロジック)
    if (userId && serverIP) {
      try {
        const url = `${serverIP}/update_preferences/${userId}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPreferencesObject), // 更新されたpreferences全体を送信
        });
        if (response.ok) {
          console.log("サーバーへ感情設定を保存成功。");
          setStatusMessage(`気分を「${selectedEmotion}」に設定しました！`);
        } else { throw new Error(`サーバーエラー: ${response.status}`); }
      } catch (e) {
        console.error("サーバーへの感情設定保存失敗:", e);
        Alert.alert("通信エラー", "設定の同期に失敗しました。");
      }
    }

    // 3. AsyncStorageにも設定を保存
    try {
      await AsyncStorage.setItem(`${ASYNC_STORAGE_PREFERENCES_KEY}_${userId}`, JSON.stringify(updatedPreferencesObject));
      console.log("感情設定をAsyncStorageに保存しました。");
    } catch (e) { console.error("AsyncStorageへの感情設定保存失敗:", e); }
  };

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
        playSoundEffect('bottleArrive');
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
    if (userId && userId !== 'unknown-user' && userId !== '' && serverIP && !arrivedBottle && soundsLoaded) {
      console.log(`ポーリングを開始します (ユーザーID: ${userId})`);
      fetchNewLetterFromServer();
      const intervalId = setInterval(fetchNewLetterFromServer, POLLING_INTERVAL);
      return () => {
        console.log(`ポーリングを停止します (ユーザーID: ${userId})`);
        clearInterval(intervalId);
      };
    }
  }, [userId, serverIP, soundsLoaded]);

  // 新しく届いた瓶をホーム画面から開封する
  const [messageToOpenDetails, setMessageToOpenDetails] = useState(null);

  const handleOpenNewBottle = (bottleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        playSoundEffect('send');
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

  // settingsVisible が true になったときに tempCustom を現在の preferences で初期化
  useEffect(() => {
    if (settingsVisible) {
      setTempIP(serverIP);
      setTempEmotion(preferences.emotion || "");
      setTempCustom(preferences.custom || "");
    }
  }, [settingsVisible, serverIP, preferences]); // 依存配列に preferences を追加

  const saveSettings = async () => { // ★ async 関数に変更
    // 1. まずReactのステートを更新（UI即時反映のため）
    const updatedPreferencesObject = {
      emotion: tempEmotion.trim(),
      custom: tempCustom.trim(),
    };
    setPreferences(updatedPreferencesObject);
    setServerIP(tempIP); // serverIPの更新はそのまま
    setSettingsVisible(false); // モーダルを閉じる

    let serverSaveOk = false;
    // 2. サーバーに設定を送信 (有効なuserIdとserverIPがある場合)
    if (userId && !userId.startsWith('user-fallback') && !userId.startsWith('user-error') && serverIP) {
      try {
        const url = `${serverIP}/update_preferences/${userId}`;
        console.log("サーバーに受信好み設定を送信中:", url);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPreferencesObject), // Pydanticモデルに合わせて送信
        });

        if (response.ok) {
          const result = await response.json();
          if (result.status === "preferences_updated") {
            console.log("サーバーへの設定保存成功:", result.updated_preferences);
            // サーバーからの最新のpreferencesでローカルステートを更新しても良い(今回は送信したもので確定)
            // setPreferences(result.updated_preferences);
            setStatusMessage('✅ 設定を保存しました！');
            serverSaveOk = true;
          } else {
            throw new Error(result.detail || "サーバーでの設定更新応答エラー");
          }
        } else {
          throw new Error(`サーバーエラー (update_preferences): ${response.status}`);
        }
      } catch (e) {
        console.error("サーバーへの設定保存失敗:", e);
        // サーバー保存失敗のメッセージは、ローカル保存後に設定
      }
    }

    // 3. AsyncStorageに設定を保存 (サーバー接続の成否に関わらず実行)
    try {
      await AsyncStorage.setItem(`${ASYNC_STORAGE_PREFERENCES_KEY}_${userId}`, JSON.stringify(updatedPreferencesObject));
      console.log("受信好み設定をAsyncStorageに保存しました:", updatedPreferencesObject);
      if (serverSaveOk) {
        // サーバー保存成功のメッセージは上で設定済み
      } else { // サーバーへの送信を試みたが失敗した場合
        Alert.alert('同期エラー', '設定はサーバへの同期に失敗しました。ネット接続を確認して再度お試しください。');
      }
    } catch (e) {
      console.error("AsyncStorageへの設定保存失敗:", e);
      Alert.alert("ローカル保存エラー", "設定のローカル保存中にエラーが発生しました。");
      if (!serverSaveOk && userId && serverIP) { // サーバーも失敗、ローカルも失敗
          Alert.alert('エラー', '設定の保存に失敗しました。');
      }
    }
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

  // --- ホーム画面のアニメーション ---
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height

  // --- 船のアニメーション ---
  const boatTranslateX = useRef(new Animated.Value(-windowWidth*0.1)).current; // 画面左外からスタート
  const boatRotate = useRef(new Animated.Value(0)).current; // 揺れの角度用
  useEffect(() => {
    let isMounted = true; // クリーンアップ後の不要な実行を防ぐフラグ

    // 船の揺れアニメーション (常にループ)
    const boatRockingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(boatRotate, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(boatRotate, { toValue: -1, duration: 2500, useNativeDriver: true }),
        Animated.timing(boatRotate, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    );

    // 船の移動アニメーション (ランダムな間隔でループ)
    const runBoatMovingSequence = () => {
      if (!isMounted) return;

      // 1. アニメーション開始前に船を画面左外にリセット
      boatTranslateX.setValue(windowWidth * 1.2); // 船の幅を考慮して画面外に

      // 2. 移動アニメーションを開始
      Animated.timing(boatTranslateX, {
        toValue: -windowWidth * 0.2, // 画面右外へ
        duration: 50000,            // 移動速度を調整 (例: 50秒)。この値を大きくすると遅くなります。
        useNativeDriver: true,
      }).start(() => {
        // 3. アニメーション完了後、次の開始までの待機時間をランダムに設定
        if (isMounted) {
          const randomDelay = Math.random() * 15000 + 5000; // 5000ms (5秒) ～ 20000ms (20秒) の間
          console.log(`次の船の出現まで: ${Math.round(randomDelay / 1000)}秒`);
          setTimeout(runBoatMovingSequence, randomDelay); // ★ ランダムな時間後に再度アニメーションを開始
        }
      });
    };

    boatRockingAnimation.start();
    runBoatMovingSequence(); // 最初の移動を開始

    return () => { // クリーンアップ
      isMounted = false;
      boatRockingAnimation.stop();
      // boatTranslateX は stop() を呼ぶと途中で止まってしまうので、
      // isMounted フラグで次のループが始まらないようにするだけでOK
    };
  }, []); // 初回マウント時のみ実行

  const boatSpin = boatRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-5deg', '5deg'], // -5度から5度の間で揺れる
  });

  // --- カモメのアニメーション ---
  const beta = 0.6;
  const seagulls = [
    { id: 1, offset: { x: 0 * beta, y: 0 * beta }, scale: 1.0 * beta, initialRotation: '-10deg' },
    { id: 2, offset: { x: 60 * beta, y: 25 * beta }, scale: 0.8 * beta, initialRotation: '5deg' },
    { id: 3, offset: { x: -50 * beta, y: 25 * beta }, scale: 1.1 * beta, initialRotation: '15deg' },
    { id: 4, offset: { x: 30 * beta, y: 50 * beta }, scale: 0.9 * beta, initialRotation: '-5deg' },
  ];

  // 群れ全体の基準点と透明度
  const flockOpacity = useRef(new Animated.Value(0)).current;
  const flockTranslateX = useRef(new Animated.Value(0)).current;
  const flockTranslateY = useRef(new Animated.Value(0)).current;
  // 4羽それぞれの揺れを管理するアニメーション値の配列
  const seagullRotateAnims = useRef(seagulls.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let isMounted = true;

    // 個別のカモメの揺れアニメーション (常に実行) 
    const rockingAnimations = seagulls.map((seagull, index) => {
      // 各カモメに少しずつ違う揺れを与える
      const duration = 300 + Math.random() * 300; // 1.2秒～1.8秒で揺れる
      return Animated.loop(
        Animated.sequence([
          Animated.timing(seagullRotateAnims[index], { toValue: 1.0, duration, useNativeDriver: true }),
          Animated.timing(seagullRotateAnims[index], { toValue: 0.0, duration, useNativeDriver: true }),
          Animated.timing(seagullRotateAnims[index], { toValue: -1.0, duration, useNativeDriver: true }),
          Animated.timing(seagullRotateAnims[index], { toValue: 0.0, duration, useNativeDriver: true }),
        ])
      );
    });
    Animated.parallel(rockingAnimations).start(); // 全員一斉に揺れ始める


    // 群れ全体の出現・移動・消滅アニメーション (間欠的に実行)
    const animateFlock = () => {
      if (!isMounted) return;

      // アニメーション開始前に初期状態へリセット
      flockOpacity.setValue(0);
      let startX = windowWidth * 0.2;
      if (Math.random() > 0.5) {
        startX = windowWidth * 0.7;
      }
      const startY = windowHeight * (Math.random() * 0.1 + 0.2); // 画面上部20%のランダムな高さ
      flockTranslateX.setValue(startX);
      flockTranslateY.setValue(startY);

      const endX = startX + (windowWidth * (Math.random() * 0.3 - 0.15)); // 画面左外へ
      const endY = startY + (windowWidth * (Math.random() * 0.1 - 0.05)); // 少し上下に揺らぎながら移動

      // アニメーションのシーケンスを定義
      Animated.sequence([
        // (A) 少し待ってからフェードイン
        Animated.delay(1000),
        Animated.timing(flockOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),

        // (B) 10秒かけて移動しながらフェードアウト
        Animated.parallel([
          Animated.timing(flockTranslateX, { toValue: endX, duration: 10000, useNativeDriver: true }),
          Animated.timing(flockTranslateY, { toValue: endY, duration: 10000, useNativeDriver: true }),
          // フェードアウトは少し遅れて開始
          Animated.sequence([
              Animated.delay(7000), // 7秒間は表示されたまま
              Animated.timing(flockOpacity, { toValue: 0, duration: 3000, useNativeDriver: true }) // 残り3秒で消える
          ])
        ]),

        // (C) 次の出現までの待機時間
        Animated.delay(Math.random() * 4000 + 8000) // 8秒から12秒のランダムな待ち時間

      ]).start(() => {
        // 完了したら再度アニメーションを開始してループさせる
        animateFlock();
      });
    };

    // 最初の遅延（アプリ起動後すぐに出ないように）
    setTimeout(() => {
      animateFlock();
    }, 2000); // 2秒後に初回開始

    return () => {
      isMounted = false; // クリーンアップ
      rockingAnimations.forEach(anim => anim.stop());
    };
  }, []); // 初回マウント時のみ実行

  // --- クジラのアニメーション ---
  const whaleOpacity = useRef(new Animated.Value(0)).current;
  const whaleTranslateX = useRef(new Animated.Value(0)).current;
  const whaleTranslateY = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(0)).current; // 水しぶき用
  
  useEffect(() => {
    let isMounted = true; // クリーンアップ後の不要な実行を防ぐフラグ

    const animateWhale = () => {
      if (!isMounted) return;

      // --- アニメーションの準備 ---
      // 1. 開始・終了位置と各種時間を定義
      const startX = windowWidth * 0.1;
      const endX = windowWidth * 0.3; 
      const startY = windowHeight * 0.5;

      // 2. アニメーション開始前に値をリセット
      whaleOpacity.setValue(0);
      splashOpacity.setValue(0);
      whaleTranslateX.setValue(startX);
      whaleTranslateY.setValue(startY); // Y座標は今回は固定

      // --- アニメーションの実行 ---
      // クジラの移動と、透明度/水しぶきの変化は並行して実行する
      Animated.parallel([
        // (A) クジラの移動アニメーション (終始動き続ける)
        Animated.timing(whaleTranslateX, {
          toValue: endX,
          duration: 10000,
          useNativeDriver: true,
        }),

        // (B) クジラの透明度と水しぶきのシーケンスアニメーション
        Animated.sequence([
          // 1. クジラがフェードイン
          Animated.timing(whaleOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
          // 2. 水しぶきが表示されるまで待機
          Animated.delay(3000), // 3秒後に水しぶきを表示
          // 3. 水しぶきのアニメーション (フェードイン → 表示維持 → フェードアウト)
          Animated.sequence([
            Animated.timing(splashOpacity, { toValue: 0.8, duration: 500, useNativeDriver: true }),
            Animated.delay(1000), // 表示維持 (フェードイン/アウトの時間を引く)
            Animated.timing(splashOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]),
          // 4. クジラがフェードアウトするまで待機
          Animated.delay(2000),
          // 5. クジラがフェードアウト
          Animated.timing(whaleOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ]).start(() => {
        // 完了したら、次の出現までのランダムな待機時間を経て再度アニメーションを開始
        if (isMounted) {
          const nextAppearanceDelay = Math.random() * 15000 + 10000; // 10秒～25秒後
          console.log(`次のクジラの出現まで: ${Math.round(nextAppearanceDelay / 1000)}秒`);
          setTimeout(animateWhale, nextAppearanceDelay);
        }
      });
    };

    // 最初の遅延（アプリ起動後すぐに出ないように）
    const initialWhaleDelay = setTimeout(() => {
      animateWhale();
    }, 5000); // 5秒後に初回開始

    // クリーンアップ関数
    return () => {
      isMounted = false;
      clearTimeout(initialWhaleDelay);
      whaleTranslateX.stopAnimation();
      whaleTranslateY.stopAnimation();
      whaleOpacity.stopAnimation();
      splashOpacity.stopAnimation();
    };
  }, []);

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

      <Video
        style={styles.backgroundVideo}
        source={require('./assets/background.mp4')} // ★ 動画ファイルのパス
        isMuted={true}
        shouldPlay={true}
        isLooping={true}
        resizeMode={ResizeMode.COVER} // ★ expo-video からインポートした ResizeMode を使用
                                      // または、文字列で "cover" と指定することも可能です
        // useNativeControls={false} // 通常、背景動画ではコントロールは不要
      />

      <View style={styles.contentOverlay}>
        <View style={styles.container}>
          {/* 設定ボタン */}
          <View style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
            <TouchableOpacity onPress={() => {setSettingsVisible(true); playSoundEffect('settingOpen');}}>
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
              playSoundEffect('writing'); // 設定開く音を再生
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
            <TouchableOpacity onPress={() => {setBoxVisible(true); playSoundEffect('boxOpen');}}>
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
                <KeyboardAwareScrollView
                  // ScrollViewと同様のスタイルやプロパティを設定可能
                  style={{ width: '100%' }} // 親のoverlayいっぱいに広がる
                  contentContainerStyle={{
                    // このスタイルで、キーボードがない時にコンテンツを中央揃えにする
                    flexGrow: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  // その他の便利なプロパティ
                  enableOnAndroid={true} // Androidでも有効にする
                  extraScrollHeight={Platform.OS === 'ios' ? 20 : 0} // キーボードと入力欄の間の追加の余白
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
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

                    {/* --- 受信好み設定: emotion --- */}
                    <Text style={styles.settingLabel}>今の気持ち (任意):</Text>
                    <TextInput
                      style={styles.modalInput} // 通常の入力欄スタイル
                      placeholder="例: 嬉しい、穏やか、考え事"
                      value={tempEmotion}       // ★ tempEmotion を使用
                      onChangeText={setTempEmotion} // ★ setTempEmotion を使用
                      maxLength={20} // 例: 20文字まで
                    />

                    {/* --- 受信好み設定 --- */}
                    <Text style={styles.settingLabel}>受信好み設定 (任意):</Text>
                    <TextInput
                      style={styles.modalInput} // ★ 複数行用スタイルを追加
                      placeholder="例: 明るい話題、短い手紙が好き。詩や物語も歓迎...（100文字まで）"
                      value={tempCustom} // ★ 新しいステート変数 (下記参照)
                      onChangeText={setTempCustom} // ★ 新しいステート更新関数 (下記参照)
                      multiline={true}
                      numberOfLines={3} // 初期表示の行数（実際の表示は内容による）
                      maxLength={100} // 最大100文字
                      textAlignVertical="top" // Androidで複数行入力のカーソル位置を上にする
                    />

                    {/* --- 保存ボタンとキャンセルボタン --- */}
                    <View style={styles.buttonRowContainer}>
                      <Pressable style={styles.buttonInRow} onPress={() => {saveSettings(); playSoundEffect('settingClose');}}>
                        <Text style={styles.buttonText}>保存</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.buttonInRow, { backgroundColor: '#AAA' }]}
                        onPress={() => {setSettingsVisible(false); playSoundEffect('settingClose');}}
                      >
                        <Text style={styles.buttonText}>キャンセル</Text>
                      </Pressable>
                    </View>
                  </View>
                </KeyboardAwareScrollView>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* 執筆モーダル */}
          <Modal visible={writingVisible} animationType="slide" transparent={true}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.overlay}>
                <KeyboardAwareScrollView
                  // ScrollViewと同様のスタイルやプロパティを設定可能
                  style={{ width: '100%' }} // 親のoverlayいっぱいに広がる
                  contentContainerStyle={{
                    // このスタイルで、キーボードがない時にコンテンツを中央揃えにする
                    flexGrow: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  // その他の便利なプロパティ
                  enableOnAndroid={true} // Androidでも有効にする
                  extraScrollHeight={Platform.OS === 'ios' ? 20 : 0} // キーボードと入力欄の間の追加の余白
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
                        onPress={sendMessage} // 送信ボタンを押したときの音を再生}
                        style={isSending ? [styles.buttonInRow, { backgroundColor: '#175C94' }] : styles.buttonInRow}
                        disabled={isSending} // 送信中はボタンを無効化
                      >
                        <Text style={styles.buttonText}>{isSending ? '送信中…' : '送信する'}</Text>
                      </Pressable>
                      <Pressable onPress={() => {
                        playSoundEffect('paper'); // 紙の音を再生
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
                </KeyboardAwareScrollView>
              </View>
            </TouchableWithoutFeedback>
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
                                playSoundEffect('bottleOpen'); // 手紙を読むときの音を再生
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
                  onPress={() => {setBoxVisible(false); playSoundEffect('boxClose');}}
                  style={[styles.button, { backgroundColor: 'rgb(60, 43, 33)', position: 'absolute', bottom: '-15%' }]}
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
                        playSoundEffect('paper'); // 手紙を読むときの音を再生
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
                                const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
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
                                    .then(() => console.log("手紙ボックスへの追加保存成功 (AsyncStorage)"))
                                    .catch(e => console.error("手紙ボックスへの追加保存失敗 (AsyncStorage):", e));
                                  return updatedMessages;
                                }
                                return currentMessages;
                              });
                              setArrivedBottle(null);
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
      </View>

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
                playSoundEffect('bottleTap', 0.9+0.1*newTapCount); // タップ音を再生
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setLargeBottleTapCount(newTapCount);
                if (newTapCount >= 4) { // 3回タップで開封
                  playSoundEffect('bottlePop'); // 開封音を再生
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
              {largeBottleTapCount < 4 ? `タップ (${largeBottleTapCount}/4)` : '開封中...'}
            </Text>
          </Animated.View>
          {/* この開封オーバーレイを閉じる「キャンセル」ボタンも必要なら追加 */}
          {/* <Pressable onPress={() => { ... (開封キャンセル処理) ... }} style={styles.cancelOpenBottleButton}>
              <Text style={styles.buttonText}>キャンセル</Text>
          </Pressable> */}
        </View>
      )}

      {/* 感情選択モーダル */}
      <Modal
        visible={emotionModalVisible}
        transparent={true}
        animationType="fade"
        // onRequestClose={() => setEmotionModalVisible(false)} // Androidバックボタンで閉じられるように
      >
        <View style={styles.overlay}>
          <LinearGradient
            colors={['#rgb(129, 50, 163)', 'rgb(91, 64, 198)']} // ★ グラデーションの色 (上:ラベンダー, 下:ライラック)
            style={styles.emotionModalContent} // ★ 既存のスタイルを適用
          >
            <Text style={styles.emotionModalTitle}>最近はどんな気分？</Text>
            <EmotionWheel onEmotionSelect={handleEmotionSelect} />
            {/* <Pressable
              style={[styles.button, { backgroundColor: '#AAA', position: 'absolute', bottom:0}]}
              onPress={() => setEmotionModalVisible(false)} // 「今は選択しない」場合
            >
              <Text style={styles.buttonText}>あとで</Text>
            </Pressable> */}
          </LinearGradient>
        </View>
      </Modal>

      {/* ホーム画面の船アニメーション */}
      <Animated.Image
        source={require('./assets/boat.png')} // ★ 船の画像
        style={[
          styles.animatedBoat, // 下記で定義
          {
            transform: [
              { translateX: boatTranslateX },
              { rotate: boatSpin }
            ]
          }
        ]}
      />

      {/* カモメの群れのアニメーション */}
      <Animated.View style={[
        styles.animatedFlockContainer, // 下記で定義
        {
          opacity: flockOpacity,
          transform: [
            { translateX: flockTranslateX },
            { translateY: flockTranslateY }
          ]
        }
      ]}>
        {seagulls.map((seagull, index) => {
          // 各カモメの揺れを計算
          const spin = seagullRotateAnims[index].interpolate({
            inputRange: [-1, 1],
            outputRange: ['-8deg', '8deg'] // 揺れの角度
          });
          
          return (
            <Animated.Image
              key={seagull.id}
              source={require('./assets/seagull.png')} // ★ カモメのシルエット画像
              style={[
                styles.animatedSeagull, // 下記で定義
                {
                  // 群れの基準点からの相対位置
                  left: seagull.offset.x,
                  top: seagull.offset.y,
                  // 各カモメの大きさを変える
                  width: 50 * seagull.scale,
                  height: 50 * seagull.scale,
                  // 揺れアニメーションと初期角度を適用
                  transform: [
                    { rotate: spin },
                    { rotate: seagull.initialRotation }
                  ]
                }
              ]}
            />
          );
        })}
      </Animated.View>

      {/* クジラと水しぶきのアニメーションコンテナ */}
      <Animated.View style={[
        styles.animatedWhaleContainer, // 下記で定義
        {
          opacity: whaleOpacity,
          transform: [
            { translateX: whaleTranslateX },
            { translateY: whaleTranslateY }
          ]
        }
      ]}>
        {/* クジラの画像 */}
        <Image
          source={require('./assets/whale.png')}
          style={styles.whaleAndSplashImage} // ★ 共通スタイルを適用
        />
        {/* 水しぶきの画像 */}
        <Animated.Image
          source={require('./assets/splash.png')}
          style={[
            styles.whaleAndSplashImage, // ★ 共通スタイルを適用
            { opacity: splashOpacity } // 透明度のアニメーションは個別に行う
          ]}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
