import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, TextInput, Alert, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, 
  TouchableWithoutFeedback, Keyboard, Modal, Text, Pressable, Image, ImageBackground,
  Animated, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import initialMessagesData from './data/messages.json';

export default function App() {
  const [message, setMessage] = useState('');

  const [userId, setUserId] = useState('user_abc');
  const [serverIP, setServerIP] = useState('https://5ec5-157-82-128-2.ngrok-free.app'); // デフォルト値
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempIP, setTempIP] = useState(serverIP);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const [writingVisible, setWritingVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(800)).current; // 初期位置は画面外下部
  const fadeAnim = useRef(new Animated.Value(0)).current; // 透明度の初期値は0 (完全に透明)

  const [statusMessage, setStatusMessage] = useState('');

  // 手紙ボックス
  const [boxVisible, setBoxVisible] = useState(false);
  const [readingMessage, setReadingMessage] = useState(null); // 現在読んでいる手紙
  const [messages, setMessages] = useState(initialMessagesData);
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim()) {
      Alert.alert('エラー', 'メッセージを入力してください');
      return;
    }

    setStatusMessage('📤 送信中…');

    const currentServerIP = tempIP || serverIP;  // 念のため fallback もつける
    const url = `${currentServerIP}/send`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message }),
      });

      const data = await res.json();
      if (data.status === 'received') {
        setStatusMessage('✅ 送信成功！');
        setMessage('');
      } else {
        setStatusMessage('⚠️ 送信失敗');
      }
    } catch (e) {
      console.error(e);
      setStatusMessage('🚫 ネットワークエラー');
    }

    setTimeout(() => setStatusMessage(''), 1000);
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

  return (
    <SafeAreaView style={{ flex: 1 }}>
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
          <View style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10 }}>
            <TouchableOpacity onPress={() => {
              setWritingVisible(true);
              Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start();
            }}>
              <Image source={require('./assets/write-button.png')} style={{ width: 80, height: 80 }} />
            </TouchableOpacity>
          </View>

          {/* 手紙ボックスボタン */}
          <View style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10 }}>
            <TouchableOpacity onPress={() => setBoxVisible(true)}>
              <Image source={require('./assets/box-button.png')} style={{ width: 80, height: 80 }} />
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
                      style={[styles.buttonInRow, { backgroundColor: '#999' }]}
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
                  >
                  {/* 手紙コンテンツは dismiss 対象にしない */}
                  <Animated.View style={[styles.letterNoteContainer, { transform: [{ translateY: slideAnim }] }]}>
                    <ImageBackground source={require('./assets/letter.png')} style={styles.letterNote} resizeMode="stretch">
                      <TextInput
                        style={styles.letterInput}
                        multiline
                        placeholder="ここにメッセージを入力"
                        value={message}
                        onChangeText={setMessage}
                      />
                      <View style={styles.buttonRowContainer}>
                        <Pressable onPress={sendMessage} style={styles.buttonInRow}>
                          <Text style={styles.buttonText}>送信する</Text>
                        </Pressable>
                        <Pressable onPress={() => {
                          Animated.timing(slideAnim, {
                            toValue: 800,
                            duration: 300,
                            useNativeDriver: true,
                          }).start(() => setWritingVisible(false));
                        }} style={[styles.buttonInRow, { backgroundColor: '#888' }]}>
                          <Text style={styles.buttonText}>キャンセル</Text>
                        </Pressable>
                      </View>
                    </ImageBackground>
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
                source={require('./assets/shelf.png')} // shelfImageのパスを直接指定
                style={styles.shelfBackground}
                resizeMode="contain"
              >
                <View style={styles.shelfGrid}>
                  {/* ★ displayMessages を使ってマップ処理 */}
                  {displayMessages.slice(0, 9).map((msg) => ( // 最初の9件だけ表示 (3x3グリッドのため)
                    <TouchableOpacity
                      key={msg.id}
                      style={styles.bottleItemOnShelf}
                      activeOpacity={0.7}
                      onPress={() => {
                        setReadingMessage(msg);
                        setBoxVisible(false); // 棚を閉じる
                        fadeAnim.setValue(0);
                        fadeIn();
                      }}
                    >
                      <Image
                        source={require('./assets/bottle.png')} // bottleImageのパスを直接指定
                        style={styles.bottleImageOnShelf}
                      />
                      <Text numberOfLines={1} style={styles.bottleLabel}>
                        {msg.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => setBoxVisible(false)}
                  style={[styles.button, { backgroundColor: '#888', position: 'absolute', bottom:-20 }]}
                >
                  <Text style={styles.buttonText}>閉じる</Text>
                </TouchableOpacity>
              </ImageBackground>
            </View>
          </Modal>

          {/* 手紙の内容を表示するモーダル (カスタム View で) */}
          {!!readingMessage && ( // readingMessage が null でないときだけこの View を表示
            <Animated.View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 999,
                opacity: fadeAnim, // ★ Animated.Value を opacity に適用
              }}>
              {/* 便箋のコンテナ */}
              <View style={styles.letterNoteContainer}>
                <ImageBackground
                  source={require('./assets/letter.png')}
                  style={styles.letterNote}
                  resizeMode="stretch"
                >
                  <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
                      {readingMessage?.title}
                    </Text>
                    <Text style={{ fontSize: 16, color: '#333' }}>
                      {readingMessage?.content}
                    </Text>
                  </ScrollView>
                  <Pressable
                    style={[styles.button, { backgroundColor: '#888', position: 'absolute', bottom: 10 }]}
                    onPress={() => {
                      fadeOut();
                      setBoxVisible(true); // ボックスを再表示

                    }}
                  >
                    <Text style={styles.buttonText}>瓶に戻す</Text>
                  </Pressable>
                </ImageBackground>
              </View>
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
  letterNoteContainer: {
    width: Dimensions.get('window').width * 0.8,
    height: 480,
  },

  letterNote: {
    flex: 1,
    resizeMode: 'stretch',
    paddingHorizontal: 28,
    paddingTop: 40,    // ← 書き出し位置に合わせて調整
    paddingBottom: 25,
    justifyContent: 'space-between',
  },

  letterInput: {
    flex: 1,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 33.5,
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
    aspectRatio: 0.833, // 瓶の縦横比 (例: 幅70, 高さ100なら 70/100 = 0.7)
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
    marginTop: 6,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    width: '100%',
  },
});
