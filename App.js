import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  Text,
  Pressable,
  Image,
  ImageBackground,
  Animated,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import bgImage from './assets/bg1.png';

export default function App() {
  const [message, setMessage] = useState('');

  const [userId, setUserId] = useState('user_abc');
  const [serverIP, setServerIP] = useState('https://5ec5-157-82-128-2.ngrok-free.app'); // デフォルト値
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempIP, setTempIP] = useState(serverIP);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const [writingVisible, setWritingVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(800)).current; // 初期位置は画面外下部

  const [statusMessage, setStatusMessage] = useState('');

  // 手紙ボックス
  const [boxVisible, setBoxVisible] = useState(false);
  const [readingMessage, setReadingMessage] = useState(null); // 現在読んでいる手紙
  const demoMessages = [
    { id: '1', title: 'こんにちは', content: 'やあ！元気？', date: '2025-05-23' },
    { id: '2', title: '秘密の話', content: 'ここだけの話なんだけど…', date: '2025-05-22' },
    { id: '3', title: 'お知らせ', content: '明日は雨だよ☔', date: '2025-05-21' },
  ];

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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ImageBackground
        source={bgImage}
        style={styles.container}
        resizeMode="cover" // 画面比率を満たすように拡大。必要に応じて contain/stretch に
      >
        <View style={styles.container}>
          {/* 設定ボタン */}
          <View style={styles.settingsButton}>
            <TouchableOpacity onPress={() => setSettingsVisible(true)}>
              <Image source={require('./assets/setting-button.png')} style={{ width: 80, height: 80 }} />
            </TouchableOpacity>
          </View>
          {/* 執筆ボタン */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 10 }}>
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

          {/* 手紙ボックス */}
          <View style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 10 }}>
            <TouchableOpacity onPress={() => setBoxVisible(true)}>
              <Image source={require('./assets/box-button.png')} style={{ width: 80, height: 80 }} />
            </TouchableOpacity>
          </View>

          {/* 設定モーダル */}
          <Modal visible={settingsVisible} animationType="slide" transparent={true}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.overlay}>
                <View style={styles.settingContent}>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Pressable style={styles.modalButton} onPress={saveSettings}>
                      <Text style={{ color: '#fff' }}>保存</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, { backgroundColor: '#999' }]}
                      onPress={cancelSettings}
                    >
                      <Text style={{ color: '#fff' }}>キャンセル</Text>
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
                      <View style={styles.letterButtons}>
                        <Pressable onPress={sendMessage} style={styles.letterSend}>
                          <Text style={{ color: '#fff' }}>送信する</Text>
                        </Pressable>
                        <Pressable onPress={() => {
                          Animated.timing(slideAnim, {
                            toValue: 800,
                            duration: 300,
                            useNativeDriver: true,
                          }).start(() => setWritingVisible(false));
                        }} style={[styles.letterSend, { backgroundColor: '#888' }]}>
                          <Text style={{ color: '#fff' }}>キャンセル</Text>
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
                source={require('./assets/shelf.png')}
                style={styles.shelfBackground}
                resizeMode="contain"
              >
                <View style={styles.shelfGrid}>
                  {demoMessages.map((msg) => (
                    <TouchableOpacity
                      key={msg.id}
                      style={styles.bottleItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        console.log("Bottle tapped:", msg.title); // ← デバッグ
                        setReadingMessage(msg);
                      }}
                    >
                      <Image
                        source={require('./assets/bottle.png')}
                        style={styles.bottleImage}
                      />
                      <Text numberOfLines={1} style={styles.bottleLabel}>
                        {msg.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => setBoxVisible(false)}
                  style={styles.closeBoxButton}
                >
                  <Text style={{ color: '#fff' }}>閉じる</Text>
                </TouchableOpacity>
              </ImageBackground>
            </View>
          </Modal>

          {/* 手紙の内容を表示するモーダル */}
          <Modal visible={!!readingMessage} animationType="fade" transparent={true}>
            <View style={styles.overlay}>
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
                    <Text style={{ fontSize: 16, color: '#333' }}>{readingMessage?.content}</Text>
                  </ScrollView>
                  <Pressable
                    style={[styles.letterSend, { backgroundColor: '#888', margin: 20 }]}
                    onPress={() => setReadingMessage(null)}
                  >
                    <Text style={{ color: '#fff' }}>瓶に戻す</Text>
                  </Pressable>
                </ImageBackground>
              </View>
            </View>
          </Modal>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    // backgroundColor: '#fff',
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
    zIndex: 10,
  },
  settingsButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  settingContent: {
    width: '85%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  settingTitle: {
    fontSize: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
    borderRadius: 5,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  writeButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 10,
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

  letterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  letterSend: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },

  shelfBackground: {
    width: '100%',
    height: 400,  // または '80%' などでも可
    justifyContent: 'center',
    alignItems: 'center',
  },

  shelfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 30,
    columnGap: 20,
    paddingHorizontal: 10,
  },

  bottleItem: {
    width: 80,
    alignItems: 'center',
  },

  bottleImage: {
    width: 80,
    height: 100,
    resizeMode: 'contain',
  },

  bottleLabel: {
    marginTop: 6,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },

  closeBoxButton: {
    backgroundColor: '#0008',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
});
