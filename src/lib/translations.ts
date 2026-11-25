// Japanese -> English text for the 言語 setting (see language.ts and domTranslation.ts).
// The English is Khushi's from the Translation sheet (column B, matched to the live
// Japanese in column C) and the Messages sheet; strings added since are in the second
// block. A string that is not here stays Japanese in English mode. Exact match first;
// the templated texts (with a number or a name in them) are the PATTERNS below.

const FROM_SHEET: Record<string, string> = {
  学会: 'Conference',
  資料: 'Documents',
  ユーザー管理: 'User Management',
  '3D解析': '3D Analysis',
  通知: 'Notifications',
  システム更新情報とアクティビティログ: 'System Updates and Activity Log',
  モデル情報: 'Model Information',
  上流血管のサイズ: 'Upstream Vessel Size',
  下流血管のサイズ: 'Downstream Vessel Size',
  日付: 'Date',
  論文: 'Journal',
  タイトル: 'Title',
  ファイルのアップロード: 'Upload File',
  検索: 'Search',
  クリップボードにコピーされました: 'Copied to clipboard',
  ユーザーカテゴリー: 'User Category',
  組織: 'Organization',
  メール: 'Email',
  情報: 'Info',
  設定: 'Settings',
  計算式設定: 'Formula Settings',
  ログアウト: 'Log out',
  学習名: 'Learning Name',
  フォルダを開く: 'Open Folder',
  ファイルをアップロード: 'Upload File',
  '3D医療モデルビューア': '3D Medical Model Viewer',
  新しいモデルをアップロード: 'Upload New Model',
  血圧: 'Blood Pressure',
  更新: 'Update',
  血圧が更新されました: 'Blood pressure updated',
  FFRを計算: 'Calculate FFR',
  FFRを再計算: 'Recalculate FFR',
  'FFRを計算しています...': 'Calculating FFR...',
  保存: 'Save',
  学習データに保存: 'Save to Learning Data',
  利用可能なデータがありません: 'No data available',
  解剖学ガイド: 'Anatomy Guide',
  画像: 'Images',
  論文を追加: 'Add Paper',
  '本当に削除しますか？': 'Are you sure you want to delete this?',
  該当する論文が見つかりません: 'No matching papers found',
  ファイル名: 'File Name',
  フォルダを追加: 'Add Folder',
  資料登録: 'Register Document',
  フォルダ名: 'Folder Name',
  フォルダ: 'Folder',
  ブラウズ: 'Browse',
  登録: 'Register',
  編集: 'Edit',
  ユーザー登録: 'Register User',
  システム管理者: 'System Administrator',
  病院管理者: 'Hospital Administrator',
  病院一般ユーザー: 'Hospital General User',
  学習管理者: 'Learning Administrator',
  学習一般ユーザー: 'Learning General User',
  名前: 'Name',
  パスワード: 'Password',
  ビュー: 'View',
  登録者: 'Registered By',
  消去: 'Delete',
  〇〇パラメータ: 'XX Parameters',
  新規追加: 'Add New',
  該当するデータが見つかりません: 'No matching data found',
  病変近位径: 'Lesion Proximal Diameter',
  最小血管径: 'Minimum Vessel Diameter',
  病変遠位径: 'Lesion Distal Diameter',
  最小断面積: 'Minimum Cross-Sectional Area',
  狭窄率: 'Stenosis Rate',
  狭窄長: 'Stenosis Length',
  病変位置: 'Lesion Position',
  ログイン: 'Log in',
  'メールアドレスとパスワードでログインしてください。': 'Log in with your email address and password.',
  メールアドレス: 'Email address',
  'ログインに失敗しました。メールアドレスとパスワードを確認してください。':
    'Login failed. Please check your email address and password.',
  'ログイン中...': 'Logging in...',
  'パスワードをお忘れですか？': 'Forgot your password?',
  登録済みのメールアドレス: 'Registered email address',
  'パスワード再設定用のメールを送信しました。メールをご確認ください。':
    'A password reset email has been sent. Please check your email.',
  'パスワードの再設定': 'Reset Password',
  ヘルプ: 'Help',
  '各画面の操作方法について説明します。': 'Explains how to use each screen.',
  '3Dモデルを読み込めませんでした': 'Could not load the 3D model',
  不明なエラーが発生しました: 'An unknown error occurred',
  '3D解析に戻る': 'Back to 3D Analysis',
  ページが見つかりません: 'Page not found',
  ホームに戻る: 'Back to Home',
  保存に失敗しました: 'Failed to save',
  削除に失敗しました: 'Failed to delete',
  データの読み込みに失敗しました: 'Failed to load data',
  '血管の幅を測定できませんでした。別の場所を選択してください。':
    'Could not measure the vessel width. Please select a different location.',
  表示: 'View',
  削除: 'Delete',
  複製: 'Duplicate',
  リンクをコピー: 'Copy link',
  キャンセル: 'Cancel',
  ユーザー: 'User',
  メニュー: 'Menu',
  選択病変を更新しました: 'Selected lesion updated',
  タイトルの保存に失敗しました: 'Failed to save the title',
  '3D狭窄形状プレビュー': '3D stenosis shape preview',
  'モデル情報を表示': 'Show model information',
  クリックして編集: 'Click to edit',
  保存済みキャプチャ: 'Saved Capture',
  '先に2点を選択してください': 'Please select two points first',
  先に血圧の値を入力してください: 'Please enter the blood pressure value first',
  '3D医療モデル分析レポート': '3D Medical Model Analysis Report',
  保存されたキャプチャ: 'Saved capture',
  モデル画像: 'Model image',
  'FFRを計算しています…': 'Calculating FFR...',
  測定範囲を更新: 'Update Measurement Range',
  先に気になる箇所を丸で囲んでください: 'Please circle the area of interest first',
  PDFダウンロード: 'Download PDF',
  学習データに保存しました: 'Saved to learning data',
  気になる箇所を丸で囲む: 'Circle an area of interest',
  Escキーで終了: 'Press Esc to exit',
  拡大表示: 'Enlarge',
  リセットして選択をやり直す: 'Reset and start the selection over',
  '① 近位側': '① Proximal side',
  '② 遠位側': '② Distal side',
  保存中: 'Saving...',
  '保存中...': 'Saving...',
  保存しました: 'Saved',
  論文登録: 'Register Paper',
  学会名: 'Conference Name',
  登録完了: 'Registration complete',
  開く: 'Open',
  画像を変更する: 'Change image',
  フォルダがありません: 'No folders',
  未選択: 'Not selected',
  該当する資料が見つかりません: 'No matching documents found',
  ユーザーを追加: 'Add user',
  '処理中...': 'Processing...',
  該当するユーザーが見つかりません: 'No matching users found',
  データ: 'Data',
}

// Added since the sheet (names changed on 2026/11/17-24, the hints Aki worded on 11/18,
// the new controls). English worded like the sheet's.
const ADDED: Record<string, string> = {
  言語: 'Language',
  文字サイズ: 'Font size',
  大: 'Large',
  中: 'Medium',
  小: 'Small',
  ユーザー名: 'User name',
  メニューを折りたたむ: 'Collapse the menu',
  メニューを開く: 'Open the menu',
  '計測値・形状': 'Measurements and Shape',
  計測値: 'Measurements',
  '3Dビュアー': '3D Viewer',
  測定: 'Measurement',
  解析結果一覧: 'Analysis Results',
  縦断面: 'Lengthwise section',
  横断面: 'Cross-section',
  断面積: 'Cross-sectional area',
  水平線: 'Horizontal line',
  切断面: 'Cutting plane',
  最小: 'Smallest',
  手前: 'Front',
  回転: 'Rotate',
  移動: 'Move',
  病変指定: 'Select lesion',
  整列: 'Align',
  保存済みキャプチャを開く: 'Open the saved capture',
  '2点をクリックして選択（①心臓に近い側 → ②遠い側）':
    'Click to select two points (① closer to the heart → ② farther side)',
  '2点の病変位置をクリックして指定してください': 'Click the two lesion positions to specify them',
  '調整が済んだら、「測定範囲を更新」をクリックしてください':
    'When the adjustment is done, click "Update Measurement Range"',
  '「整列」から病変位置の詳細を調整できます': 'You can adjust the lesion position in detail from "Align"',
  病変指定箇所が表示されます: 'The specified lesion area will be shown',
  測定補助線の位置を調整してください: 'Please adjust the position of the measurement guide lines',
  スライダーで奥行きを調整してください: 'Please adjust the depth with the slider',
  '「+」でこのフォルダに新しいキャプチャを追加できます':
    'You can add a new capture to this folder with "+"',
  'ここをクリックして、①②の2点で病変部位を選択してください':
    'Click here and select the lesion site with two points, ① and ②',
  '①と②を入れ替える（心臓に近い側を修正）': 'Swap ① and ② (corrects the side closer to the heart)',
  ドラッグでモデルを回転: 'Drag to rotate the model',
  ドラッグでモデルを移動: 'Drag to move the model',
  拡大: 'Zoom in',
  縮小: 'Zoom out',
  全画面: 'Full screen',
  整列して断面を表示: 'Align and show the cross-section',
  奥行き: 'Depth',
  '奥行き（スライダーで調整）': 'Depth (adjust with the slider)',
  '奥 6 mm →': 'Back 6 mm →',
  奥: 'Back',
  学習範囲: 'Trained range',
  '病変を計測しています...': 'Measuring the lesion...',
  '計測中...': 'Measuring...',
}


// The messages, in the English of the Messages sheet (column F, matched to the Japanese
// of column E where Aki reworded it, else D).
const FROM_MESSAGES: Record<string, string> = {
  保存に失敗しました: 'Failed to save.',
  削除に失敗しました: 'Failed to delete.',
  データの読み込みに失敗しました: 'Failed to load the data.',
  新しいバージョンがあります: 'A new version is available.',
  '更新すると画面が再読み込みされます（保存していない内容は失われます）。':
    'Updating reloads the screen (unsaved content will be lost).',
  クリップボードにコピーされました: 'Copied to the clipboard.',
  'データを読み込んでいます...': 'Loading data...',
  'ログインに失敗しました。メールアドレスとパスワードを確認してください。':
    'Login failed. Please check your email address and password.',
  '送信に失敗しました。メールアドレスをご確認のうえ、もう一度お試しください。':
    'Sending failed. Please check the email address and try again.',
  'パスワード再設定用のメールを送信しました。メールをご確認ください。':
    'A password reset email has been sent. Please check your email.',
  'パスワードが一致しません。': 'The passwords do not match.',
  'リンクが無効です。もう一度パスワード再設定をリクエストしてください。':
    'The link is invalid. Please request a password reset again.',
  'パスワードの再設定に失敗しました。リンクの有効期限が切れている可能性があります。':
    'Failed to reset the password. The link may have expired.',
  'パスワードを再設定しました。': 'The password has been reset.',
  該当するデータが見つかりません: 'No matching data found.',
  学習名を入力してください: 'Please enter a study name.',
  '3Dモデルを読み込んでいます...': 'Loading the 3D model...',
  '血管の幅を測定できませんでした。別の場所を選択してください。':
    'The vessel width could not be measured. Please select a different location.',
  'このモデルはメートル（m）単位の可能性があります。測定値が1000分の1になってしまうため、ミリメートル（mm）単位で書き出したモデルを使用してください':
    'This model may be in metres (m). Measured values would come out 1/1000 of their true size, so please use a model exported in millimetres (mm).',
  タイトルの保存に失敗しました: 'Failed to save the title.',
  '精度を高めるため、ズームインしてください': 'Please zoom in to improve accuracy.',
  'FFRの推定式の学習範囲です。範囲外の値ではFFRを計算できません':
    'This is the range the FFR estimation formula was trained on. FFR cannot be calculated for values outside it.',
  '3Dモデルから自動計測された値です。修正できるのは病変近位径と病変遠位径だけです。最小血管径と狭窄長は自動計算された値で、修正できません（狭窄長は最小断面積の1.5倍以内が続く区間の長さです）。これらの値はFFRの計算にも使用されます。':
    'These are values measured automatically from the 3D model. Only the lesion proximal diameter and lesion distal diameter can be corrected. The minimum vessel diameter and stenosis length are calculated automatically and cannot be corrected (the stenosis length is the length of the stretch where the area stays within 1.5 times the minimum cross-sectional area). These values are also used for the FFR calculation.',
  入力値に基づき滑らかにつながる形状を生成: 'Generating a smoothly connected shape from the entered values.',
  'ここをクリックして、①②の2点で病変部位を選択してください':
    'Click here and select the lesion site with two points, ① and ②.',
  '「整列」から病変位置の詳細を調整できます': 'You can adjust the details of the lesion position from "Align".',
  '2点の病変位置をクリックして指定してください': 'Please click to specify the two lesion positions.',
  '調整が済んだら、「測定範囲を更新」をクリックしてください':
    'When the adjustment is done, click "Update Measurement Range".',
  病変指定箇所が表示されます: 'The specified lesion area is shown.',
  測定補助線の位置を調整してください: 'Please adjust the position of the measurement guide lines.',
  先に2点を選択してください: 'Please select two points first.',
  先に血圧の値を入力してください: 'Please enter the blood pressure value first.',
  先にFFRを計算してください: 'Please calculate FFR first.',
  'モデルの位置を固定しています（整列をもう一度クリックすると解除されます）':
    'The model position is locked (click "Align" again to unlock).',
  '自動計算される値です（直接編集はできません）':
    'This is an automatically calculated value (it cannot be edited directly).',
  保存しました: 'Saved.',
  選択病変を更新しました: 'The selected lesion has been updated.',
  利用可能なデータがありません: 'No data available.',
  '計測中...': 'Measuring...',
  '病変を計測しています...': 'Measuring the lesion...',
  '保存した状態を読み込んでいます...': 'Loading the saved state...',
  'PDFを作成しています...': 'Creating the PDF...',
  'FFRを計算しています...': 'Calculating FFR...',
  先に気になる箇所を丸で囲んでください: 'Please circle the area of concern first.',
  Escキーで終了: 'Press Esc to exit.',
  血圧が更新されました: 'The blood pressure has been updated.',
  学習データに保存しました: 'Saved to the learning data.',
  登録完了: 'Registration complete.',
  該当する論文が見つかりません: 'No matching papers found.',
  該当する資料が見つかりません: 'No matching documents found.',
  ファイルがありません: 'There are no files.',
  フォルダがありません: 'There are no folders.',
  'ユーザーの登録に失敗しました。メールアドレスが既に使用されている可能性があります。':
    'Failed to register the user. The email address may already be in use.',
  該当するユーザーが見つかりません: 'No matching users found.',
  '処理中...': 'Processing...',
  ページが見つかりません: 'Page not found.',
  '3Dモデルを読み込めませんでした': 'The 3D model could not be loaded.',
  不明なエラーが発生しました: 'An unknown error occurred.',
  スライダーで奥行きを調整してください: 'Please adjust the depth with the slider.',
}

// Texts the lesion and folder screens show that neither sheet has (hover texts, the
// values of 病変位置, the new headings).
const MORE: Record<string, string> = {
  // The step bar of the 3D view (Aki's wireframe of 2026/11/25).
  リセット: 'Reset',
  '① 近位径': '① Proximal diameter',
  病変始点: 'Lesion start',
  '② 遠位径': '② Distal diameter',
  病変終点: 'Lesion end',
  '③ 病変調整': '③ Lesion adjustment',
  '④ 計測': '④ Measure',
  '病変の始点（心臓に近い側）を選択': 'Select the start of the lesion (the side closer to the heart)',
  '病変の終点（遠い側）を選択': 'Select the end of the lesion (the farther side)',
  '整列して断面を表示（線と奥行きを調整）': 'Lay the vessel along the lines and show the cross-section (adjust the lines and the depth)',
  '調整が済んだら、「④ 計測」をクリックしてください': 'When the adjustment is done, click "④ Measure".',
  '「③ 病変調整」から病変位置の詳細を調整できます':
    'You can adjust the details of the lesion position from "③ Lesion adjustment".',
  '線と奥行きスライダーを調整して、「④ 計測」をクリックしてください':
    'Adjust the lines and the depth slider, then click "④ Measure".',
  'モデルの位置を固定しています（③ 病変調整をもう一度クリックすると解除されます）':
    'The model position is locked (click "③ Lesion adjustment" again to unlock).',
  'ドラッグでモデルを移動（クリックで回転に切り替え）': 'Drag to move the model (click to switch to rotate)',
  'ドラッグでモデルを回転（クリックで移動に切り替え）': 'Drag to rotate the model (click to switch to move)',
  学習内容: 'Learning Content',
  '最小血管径 | MLD': 'Minimum Vessel Diameter | MLD',
  '最小血管断面積 | MLA': 'Minimum Vessel Cross-Sectional Area | MLA',
  直径狭窄率: 'Diameter Stenosis Rate',
  平均血管径: 'Mean Vessel Diameter',
  血管内腔体積: 'Luminal Volume',
  石灰化体積: 'Calcification Volume',
  分岐角度: 'Bifurcation Angle',
  ヒントを閉じる: 'Close the hint',
  '選択した2点から計測し直します（手動で修正した値は自動計測値に戻ります）':
    'Measures again from the two selected points (values corrected by hand return to the automatic values)',
  'この計測結果をこのフォルダに保存します（解析結果一覧に追加され、フォルダを「+」で開き直しても表示されます）':
    'Saves this measurement result in this folder (it is added to the Analysis Results and is shown again when the folder is reopened with "+")',
  保存されたモデル画像: 'Saved model image',
  近位: 'Proximal',
  中間: 'Middle',
  遠位: 'Distal',
  'モデルの奥行きを調整（上：奥へ（最大6 mm）、下：元の位置。ダブルクリックで元の位置）':
    'Adjust the model depth (up: away from you, 6 mm at most; down: the original position; double-click returns it to the original position)',
  '水平線の位置（上下にドラッグ）': 'Position of the horizontal line (drag up or down)',
  '切断面の位置（最小断面積の位置に固定されています）':
    'Position of the cutting plane (fixed at the position of the minimum cross-sectional area)',
  '病変近位径の位置（左右にドラッグ）': 'Position of the lesion proximal diameter (drag left or right)',
  '病変遠位径の位置（左右にドラッグ）': 'Position of the lesion distal diameter (drag left or right)',
  近位径: 'Proximal diameter',
  遠位径: 'Distal diameter',
  ファイルの種類: 'File type',
  閉じる: 'Close',
  サイズ: 'Size',
  アップロード日: 'Upload date',
}

export const EN_TEXT: Record<string, string> = { ...FROM_SHEET, ...ADDED, ...FROM_MESSAGES, ...MORE }

// Texts with a value in them: the value stays, the words around it are translated.
export const EN_PATTERNS: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^学習範囲 (.+?)〜(.+)$/, (m) => `Trained range ${m[1]} to ${m[2]}`],
  [/^奥 (\d+) mm →$/, (m) => `Back ${m[1]} mm →`],
  [/^断面積 (.+)$/, (m) => `Cross-sectional area ${m[1]}`],
  [/^狭窄率 (.+)$/, (m) => `Stenosis rate ${m[1]}`],
  [/^FFRの計算には (.+) mm を使用$/, (m) => `${m[1]} mm is used for the FFR calculation`],
  [
    /^狭窄長 (.+) mm は学習範囲（(.+)〜(.+) mm）外のため、FFRの計算には (.+) mm を使用しています（画面の狭窄長の値は変わりません）。$/,
    (m) =>
      `The stenosis length ${m[1]} mm is outside the trained range (${m[2]}-${m[3]} mm), so ${m[4]} mm is used for the FFR calculation (the stenosis length shown on screen does not change).`,
  ],
  [
    /^病変の値が推定式の学習範囲外です: (.+)。この病変ではFFRを計算できません。$/,
    (m) => {
      const details = m[1]
        .split('、')
        .map((part) => {
          const found = /^(.+?)\((.*)\)$/.exec(part)
          return found ? `${EN_TEXT[found[1]] ?? found[1]} (${found[2].replace('〜', ' to ')})` : part
        })
        .join(', ')
      return `The lesion values are outside the range the estimation formula was trained on: ${details}. FFR cannot be calculated for this lesion.`
    },
  ],
]

/** The English for a Japanese text, or null when there is none (it then stays as it is). */
export function toEnglish(text: string): string | null {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  if (!match) return null
  const [, lead, core, tail] = match
  if (!core) return null
  const exact = EN_TEXT[core]
  if (exact !== undefined) return lead + exact + tail
  for (const [pattern, build] of EN_PATTERNS) {
    const found = pattern.exec(core)
    if (found) return lead + build(found) + tail
  }
  return null
}
