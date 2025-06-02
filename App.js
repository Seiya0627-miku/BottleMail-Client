import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, TextInput, Alert, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, 
  TouchableWithoutFeedback, Keyboard, Modal, Text, Pressable, Image, ImageBackground, FlatList,
  Animated, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import initialMessagesData from './data/messages.json';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

const windowWidth = Dimensions.get('window').width;

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
// --- ここまでが便箋サイズの計算 ---

export default function App() {
  // 設定
  const [userId, setUserId] = useState("unknown-user"); // 初期値は適当な文字列
  const [serverIP, setServerIP] = useState('http://192.168.3.3:8000'); // デフォルト値
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempIP, setTempIP] = useState(serverIP);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // ユーザーIDを取得 (アプリケーションのIDを使用)
  useEffect(() => {
    // デバイスID取得処理を useEffect 内の async 関数に記述
    const fetchAndSetDeviceSpecificId = async () => {
      let fetchedId = null;
      let shortenedId = null;
      
      try {
        if (Platform.OS === 'android') {
          fetchedId = Application.androidId;
          console.log('Android ID:', fetchedId);
        } else if (Platform.OS === 'ios') {
          fetchedId = await Application.getIosIdForVendorAsync();
          console.log('iOS ID for Vendor:', fetchedId);
        }

        if (fetchedId) {
          // 元のIDをSHA-256でハッシュ化 (結果は16進数文字列)
          const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256, // ハッシュアルゴリズム
            fetchedId,                     // ハッシュ化する元の文字列
            { encoding: Crypto.CryptoEncoding.HEX } // 出力を16進数文字列に
          );

          // 3. ハッシュ化された文字列を短縮 (先頭12文字)
          const desiredLength = 12;
          shortenedId = digest.substring(0, desiredLength);

          setUserId(`user-${shortenedId}`);
          setTempUserId(`user-${shortenedId}`);
        } else {
          // expo-application からIDが取得できなかった場合の非常にシンプルなフォールバック
          const fallbackId = 'unknown-device';
          console.warn('Device-specific ID could not be obtained, using fallback:', fallbackId);
          setUserId(fallbackId);
          setTempUserId(fallbackId);
          Alert.alert("ID取得エラー", "デバイス固有のIDを取得できませんでした。");
        }
      } catch (error) {
        console.error("Error fetching device specific ID:", error);
        const errorFallbackId = 'error-fetching-id';
        setUserId(errorFallbackId);
        setTempUserId(errorFallbackId);
        Alert.alert("ID取得エラー", "ID取得中に予期せぬエラーが発生しました。");
      }
    };

    fetchAndSetDeviceSpecificId();
  }, []); // このuseEffectはアプリ起動時に一度だけ実行されます

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

  // 手紙ボックス
  const [boxVisible, setBoxVisible] = useState(false);
  const [readingMessage, setReadingMessage] = useState(null); // 現在読んでいる手紙
  const [messages, setMessages] = useState(initialMessagesData);
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  const itemsPerPage = 9; // 1ページあたりのアイテム数
  // ページ分割されたメッセージの配列 (例: [ [msg1-9], [msg10-18], ... ])
  const paginatedMessages = useMemo(() => {
    if (!displayMessages || displayMessages.length === 0) {
      return []; // メッセージがない場合は空の配列
    }
    const pages = [];
    for (let i = 0; i < displayMessages.length; i += itemsPerPage) {
      pages.push(displayMessages.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [displayMessages]);
  const totalPages = paginatedMessages.length;
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [shelfContainerWidth, setShelfContainerWidth] = useState(0); // 棚コンテナの実際の幅

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
      if (data.status === 'received') {
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

  const saveSettings = () => {
    setUserId(tempUserId);
    setServerIP(tempIP);
    setSettingsVisible(false);
  };
  const cancelSettings = () => {
    setTempUserId(userId); // 元の値に戻す
    setTempIP(serverIP); // 元の値に戻す
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
      setReadingMessage(null);
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
      {statusMessage ? ( // 「送信成功！」の時だけこれがtrueになる
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
              <Image source={require('./assets/setting-button.png')} style={{ width: 80, height: 80 }} />
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

          {/* 設定モーダル */}
          <Modal visible={settingsVisible} animationType="slide" transparent={true}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.overlay}>
                <View style={{width: '85%', backgroundColor: 'rgb(118, 182, 255)', padding: 20, borderRadius: 10}}>
                  <Text style={styles.settingTitle}>設定</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ユーザーID"
                    value={tempUserId}
                    onChangeText={setTempUserId}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="サーバーIPアドレス"
                    value={tempIP}
                    onChangeText={setTempIP}
                  />
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
                {/* shelfContainerWidthが取得され、表示するメッセージがある場合のみFlatListを表示 */}
                {shelfContainerWidth > 0 && paginatedMessages.length > 0 && (
                  <FlatList
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
                                setReadingMessage(msg);
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
                  <View style={[styles.shelfPage, { width: shelfContainerWidth, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={styles.emptyShelfText}>手紙はまだありません</Text>
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
              styles.overlay, // ★ 新しいスタイル (下記参照)
              { opacity: fadeAnim } // ★ 手紙を読むモーダル専用のアニメーション値
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
                      style={[styles.button, { backgroundColor: '#AAA' }]} // ★ 以前定義したボタン共通スタイルをベースに
                      onPress={() => {
                        fadeOut();
                        setBoxVisible(true);
                      }}
                    >
                      <Text style={styles.buttonText}>瓶に戻す</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </ImageBackground>
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
  settingTitle: {
    fontSize: 24,
    marginBottom: 12,
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'bold'
  },
  modalInput: {
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderWidth: 1,
    marginBottom: 12,
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
  letterNote: { // ★ImageBackground (便箋画像) のスタイル
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
    width: '100%',
    height: 400,  // または '80%' などでも可
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, 
  },
  shelfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', // ★ 左詰めにする (または 'space-between' や 'center' でアイテムを中央寄せ)
    // alignItems: 'center', // 各行のアイテムを中央揃え（高さが異なる場合など）
    width: '85%', // ★ shelfBackground の幅に対して、グリッドが占める幅 (例: 85%)
                    // この幅の中に3つの瓶がきれいに収まるように調整します
    // paddingVertical: 10, // グリッド全体の上下の余白
    // backgroundColor: 'rgba(255,0,0,0.2)', // デバッグ用に背景色をつけて確認すると良い
  },
  bottleItemOnShelf: { // 瓶のTouchableOpacity用のスタイル
    // (shelfGridの幅) / 3 から、左右のマージンを引いた値が目安
    width: '30%',     // ★ shelfGridの幅に対して30% (3つ並べるので約33.3%からマージン分を引く)
    aspectRatio: 0.8536, // 瓶の縦横比 (例: 幅70, 高さ100なら 70/100 = 0.7)
    alignItems: 'center',
    justifyContent: 'center', // 瓶画像とラベルをコンテナ内で中央に
    marginHorizontal: '1.5%', // 瓶同士の左右の間隔 (30% * 3 + 1.5% * 6 = 99%)
  },
  bottleImageOnShelf: { // 瓶のImageコンポーネント用のスタイル
    width: '75%',  // bottleItemOnShelfの幅に対して80%
    height: '75%', // bottleItemOnShelfの高さに対して70% (aspectRatioで調整)
    resizeMode: 'contain',
  },
  bottleLabel: {
    marginTop: 4,
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
    justifyContent: 'flex-start', // ★★★ グリッドをページの上端から配置する
    alignItems: 'center',         // ★★★ グリッド自体をページ内で水平中央に配置
    paddingTop: 30,               // ★ 棚の画像の上端から最初の瓶までの余白 (お好みで調整)
    paddingBottom: 20,            // ★ 棚の画像の下端と最後の瓶またはページインジケータとの余白 (お好みで調整)
    // backgroundColor: 'rgba(0,0,255,0.1)', // デバッグ用に一時的に背景色をつけると分かりやすい
  },
  pageIndicatorContainer: {
    position: 'absolute', // 棚画像の上に重ねて表示
    bottom: 10, // 閉じるボタンとの兼ね合いで調整 (棚の下部からの位置)
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
    fontSize: 16,
    // fontWeight: 'bold',
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
});
