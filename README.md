## 環境構築（Windows 11, VS Code, powershell）
### 1. node.js のインストール
[ここ](https://nodejs.org/ja/)からインストールできる。インストールしたら VS Code を再起動して以下のコマンドで確認する。

```powershell:node.jsのインストールが完了したか確認
node --version
npm --version
```
もし確認の際に権限の問題が生じたら、次のコマンドを入力して、現在の実行ポリシーを確認。
```powershell
Get-ExecutionPolicy
```

`Restricted`と出たら、以下のコマンドで一時的に実行ポリシーを変更できる。
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. Expo のインストール
npmコマンドからインストールします。
```powershell:Expoのインストール
npm install -g expo-cli
npm install @react-native-async-storage/async-storage
npx expo install expo-application
npx expo install expo-crypto
npx expo install expo-av
npx expo install react-native-keyboard-aware-scroll-view

#expoコマンドが使えるか確認
expo --version
```

参考資料：https://qiita.com/BanaoLihua/items/33f05d368f9bbd0bb741

## QRコード生成
以下の VS Code のターミナル（Powershell）に入力して実行すると Expo Go 用 の QR コードが生成される。Expo Go がインストールされているスマホのカメラで読み込めばアプリが起動する。

```
$ npx expo start
```
`Unable to find expo in this project - have you run yarn / npm install yet?`みたいな感じで怒られたら依存性の問題が出ているということらしいので、以下のコマンドを実行する。
```powershell
npm install
```