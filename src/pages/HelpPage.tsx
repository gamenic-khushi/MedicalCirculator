import { useAuth } from '@/hooks/useAuth'
import { isAdminCategory } from '@/types/user'

interface GuideSection {
  title: string
  body: string[]
}

const SECTIONS: GuideSection[] = [
  {
    title: '3D解析（フォルダと3Dモデル）',
    body: [
      '「新規追加」で新しい3Dモデルファイルをアップロードすると、1つのフォルダが作成されます。1つのフォルダには1つの3Dモデルのみが登録されます。',
      'フォルダの✏️（編集）から、そのフォルダに保存されている過去の計測結果の一覧を確認できます。',
      '一覧の「+」は、そのフォルダに既に登録されている3Dモデルを再利用して新しい計測を始めるためのボタンです。新しいファイルをアップロードするものではありません。',
    ],
  },
  {
    title: '病変の選択と計測',
    body: [
      'ポインターのアイコンをクリックすると、2点を選択するモードになります。①が心臓に近い側、②が遠い側になるように、血管上の2点をクリックしてください。',
      '2点を選択した後は、点をドラッグして位置を微調整できます。位置が決まったら「測定範囲を更新」で計測を確定します。',
    ],
  },
  {
    title: '「仮保存」と「解析履歴に保存」／「学習データに保存」の違い',
    body: [
      '「仮保存」は一時的な保存です。この画面を離れる（ページを再読み込みする、別の画面に移動する）と失われます。他のユーザーからは見えません。',
      '「解析履歴に保存」（病変解析画面）および「学習データに保存」（3Dビューア画面）は、計測結果を永続的に保存します。保存したデータは削除するまで残り、他のユーザーからも見えます。',
      '記録として残したい計測結果は、必ず「解析履歴に保存」または「学習データに保存」を使用してください。',
    ],
  },
  {
    title: '資料',
    body: [
      'フォルダを追加すると、ファイルをアップロードする前でも空のフォルダとして保存されます。',
      'ファイルのアップロード時に画像を選択すると、その画像は資料の一覧でプレビュー表示されます。',
    ],
  },
]

const ADMIN_SECTIONS: GuideSection[] = [
  {
    title: '計算式設定（管理者のみ）',
    body: [
      'FFR（狭窄率から算出する血流予備量比）の計算に使用する狭窄係数を設定します。ここで保存した値は、以後すべてのユーザーのFFR計算に反映されます。',
    ],
  },
  {
    title: 'ユーザー管理（管理者のみ）',
    body: [
      'パスワードを入力してユーザーを登録すると、ログイン可能な実際のアカウントが作成されます。パスワードを入力しない場合は、ログインできないプロフィールのみの登録になります。',
      'メールアドレスは、そのユーザーの実際のログインアカウントと対応づけるために使用されます。既存ユーザーのメールアドレスを変更する際はご注意ください。',
    ],
  },
]

function Section({ title, body }: GuideSection) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {body.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-gray-600">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  )
}

export function HelpPage() {
  const { user } = useAuth()
  const isAdmin = isAdminCategory(user?.category)

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">ヘルプ</h1>
      <p className="mt-1 text-sm text-gray-500">各画面の操作方法について説明します。</p>

      <div className="mt-4 border-b border-gray-200" />

      <div className="mt-6 flex max-w-2xl flex-col gap-4">
        {SECTIONS.map((section) => (
          <Section key={section.title} {...section} />
        ))}
        {isAdmin && ADMIN_SECTIONS.map((section) => <Section key={section.title} {...section} />)}
      </div>
    </div>
  )
}
