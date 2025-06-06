import { StyleSheet, Dimensions, Platform } from 'react-native';

// --- 便箋のサイズ制約 ---
const windowWidth = Dimensions.get('window').width;
const MAX_STATIONERY_WIDTH = 300;
const MAX_STATIONERY_HEIGHT = 400;
const TARGET_ASPECT_RATIO_H_W = 4 / 3; // 高さ / 幅 (400 / 300)
const MAX_SCREEN_WIDTH_PERCENTAGE = 0.8; // 画面幅の最大80%

// --- 便箋の実際のサイズを計算 ---
export let actualStationeryWidth = windowWidth * MAX_SCREEN_WIDTH_PERCENTAGE;

// 1. 最大幅の制約を適用
if (actualStationeryWidth > MAX_STATIONERY_WIDTH) {
  actualStationeryWidth = MAX_STATIONERY_WIDTH;
}

// 2. この幅に基づいて、目標アスペクト比から高さを計算
export let actualStationeryHeight = actualStationeryWidth * TARGET_ASPECT_RATIO_H_W;

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
export let actualShelfDisplayWidth = Math.min(MAX_SHELF_HEIGHT, MAX_SHELF_WIDTH);
export let actualShelfDisplayHeight = actualShelfDisplayWidth * shelfAspectRatio_H_W;

// クジラのサイズ設定
const WHALE_ASPECT_RATIO = 439/268; // クジラ画像の縦横比 (例: 200px x 200px なら 1)
const whaleWidth = Dimensions.get('window').width * 0.25;
const whaleHeight = whaleWidth / WHALE_ASPECT_RATIO;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  contentOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
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
  // 新しい瓶を表示するエリアのスタイル
  newBottlesArea: { // 新しい瓶をまとめて表示するエリアのスタイル
    position: 'absolute',
    bottom: '15%', // 例: メイン操作ボタン群の上あたり
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
  // 感情モーダルのスタイル
  emotionModalContent: {
    width: '90%',
    maxWidth: 350,
    // backgroundColor: 'rgb(150, 100, 179)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  emotionModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  // 背景アニメーション
  animatedBoat: {
    position: 'absolute',
    width: '13%', // 船のサイズ (調整してください)
    height: '13%', // 船のサイズ
    resizeMode: 'contain',
    top: '45%', // 画面の上から40%の位置 (海の高さに合わせて調整)
    left: 0, // translateXで動かすので、初期のleftは0か画面外
    transform: [{ translateX: -100 }], // 初期位置を画面左外に
    zIndex: 5, // 他のUI要素との重なり順
  },
  animatedFlockContainer: { // 群れ全体の基準点となるコンテナ
    position: 'absolute',
    // width と height は内部要素で決まるので不要
    zIndex: 4, // 船の後ろに配置
    top: 0,    // 画面の上端に配置
    left: 0,   // 画面の左端に配置
    right: 0,  // 画面の右端まで広げる
    bottom: 0, // 画面の下端まで広げる
  },
  animatedSeagull: { // 各カモメの基本スタイル
    position: 'absolute', // 親(animatedFlockContainer)の中で絶対配置
    resizeMode: 'contain',
  },
  animatedWhaleContainer: { // クジラと水しぶきをまとめるコンテナ
    position: 'absolute',
    width: whaleWidth,
    height: whaleHeight,
    alignItems: 'center', // クジラと水しぶきを水平中央に
    zIndex: 6, // 船やカモメとの重なり順を調整
    // backgroundColor: "rgba(0, 200, 0, 0.5)",
  },
  whaleAndSplashImage: {
    position: 'absolute', // 親(animatedWhaleContainer)の中で重ねる
    top: 0,
    left: 0,
    width: '100%', // 親コンテナのサイズに追従
    height: '100%',
    resizeMode: 'contain',
  },
});

export default styles;