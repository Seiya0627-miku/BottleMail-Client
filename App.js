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
import bgImage from './assets/background.png';

export default function App() {
  const [message, setMessage] = useState('');

  const [userId, setUserId] = useState('user_abc');
  const [serverIP, setServerIP] = useState('http://172.20.10.2:8000'); // デフォルト値
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempIP, setTempIP] = useState(serverIP);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const [writingVisible, setWritingVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(800)).current; // 初期位置は画面外下部

  const [statusMessage, setStatusMessage] = useState('');

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
          <View style={styles.writeButton}>
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
});
