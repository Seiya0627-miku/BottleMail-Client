import React, { useState } from 'react';
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
} from 'react-native';

export default function App() {
  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('user_abc');
  const [serverIP, setServerIP] = useState('http://172.20.10.2:8000'); // デフォルト値
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempSender, setTempSender] = useState(sender);
  const [tempIP, setTempIP] = useState(serverIP);

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
      body: JSON.stringify({ sender, message }),
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
    setSender(tempSender);
    setServerIP(tempIP);
    setSettingsVisible(false);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* 設定ボタン */}
            <View style={styles.settingsButton}>
              <Button title="⚙️設定" onPress={() => setSettingsVisible(true)} />
            </View>

            {/* 入力欄と送信ボタン */}
            <TextInput
              style={styles.input}
              multiline
              placeholder="ここにメッセージを入力"
              value={message}
              onChangeText={setMessage}
            />
            <Button title="瓶に入れて送る" onPress={sendMessage} />
            <Text style={{ marginTop: 10, color: '#444', textAlign: 'center' }}>{statusMessage}</Text>

            {/* モーダル */}
            <Modal visible={settingsVisible} animationType="slide" transparent={true}>
              <View style={styles.modalBackground}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>⚙️ 設定</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ユーザーID"
                    value={tempSender}
                    onChangeText={setTempSender}
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
                      onPress={() => setSettingsVisible(false)}
                    >
                      <Text style={{ color: '#fff' }}>キャンセル</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  settingsButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  input: {
    height: 150,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
    textAlignVertical: 'top',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
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
});
