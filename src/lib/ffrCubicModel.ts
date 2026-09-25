// LAD FFR cubic-diameter estimation model, per
// FFR_Cubic_Diameter_Report_20260922 (model identifier
// LAD_FFR_CUBIC_DIAMETER_20260922_R1). Estimates FFR from five measured
// inputs via a 56-term (1 constant + 5 linear + 15 quadratic + 35 cubic)
// least-squares polynomial fit over 2,840 CFD cases, without running CFD
// itself. Coefficients and standardization constants are recorded at
// 17-digit precision in the source report and must be kept in sync with it
// as a set — do not tune one without the others.
//
// This formula is specific to LAD lesions and was fit only within the
// input ranges in FFR_INPUT_RANGES; extrapolating outside them is not
// supported by the source report, which explicitly calls for detecting and
// flagging out-of-range input rather than returning a number for it.

export interface FfrCubicInputs {
  /** Proximal reference diameter, mm. Diameter, not radius. */
  dp: number
  /** Distal reference diameter, mm. Diameter, not radius. */
  dd: number
  /** Minimum stenosis cross-sectional area, mm² (not a diameter). */
  a: number
  /** Stenosis length along the centerline path, mm. */
  l: number
  /** Blood pressure used for the estimate, mmHg. */
  p: number
}

export type FfrCubicInputKey = keyof FfrCubicInputs

// [min, max] observed range each input was trained on.
export const FFR_INPUT_RANGES: Record<FfrCubicInputKey, [number, number]> = {
  dp: [3, 5],
  dd: [3, 5],
  a: [0.28274328, 2.54468952],
  l: [1, 8],
  p: [80, 120],
}

export const FFR_INPUT_LABELS: Record<FfrCubicInputKey, string> = {
  dp: '病変近位径',
  dd: '病変遠位径',
  a: '最小断面積',
  l: '狭窄長',
  p: '血圧',
}

export const FFR_INPUT_UNITS: Record<FfrCubicInputKey, string> = {
  dp: 'mm',
  dd: 'mm',
  a: 'mm²',
  l: 'mm',
  p: 'mmHg',
}

/** Inputs (by key) that fall outside the trained range — empty if all are within range. */
export function findOutOfRangeFfrInputs(inputs: FfrCubicInputs): FfrCubicInputKey[] {
  return (Object.keys(FFR_INPUT_RANGES) as FfrCubicInputKey[]).filter((key) => {
    const [min, max] = FFR_INPUT_RANGES[key]
    const value = inputs[key]
    return !Number.isFinite(value) || value < min || value > max
  })
}

/** User-facing error text naming which inputs are outside the model's trained range. */
export function describeFfrRangeError(outOfRangeKeys: FfrCubicInputKey[]): string {
  const details = outOfRangeKeys
    .map((key) => {
      const [min, max] = FFR_INPUT_RANGES[key]
      return `${FFR_INPUT_LABELS[key]}(${min}〜${max}${FFR_INPUT_UNITS[key]})`
    })
    .join('、')
  return `病変の値が推定式の学習範囲外です: ${details}。この病変ではFFRを計算できません。`
}

export function computeFfrCubic({ dp, dd, a, l, p }: FfrCubicInputs): number {
  const z1 = (dp - 4) / 0.76453060256180794
  const z2 = (dd - 3.936619718309859) / 0.72641109623817635
  const z3 = (a - 1.3389376608450705) / 0.73651135322061001
  const z4 = (l - 4.3478873239436622) / 2.4365387106944469
  const z5 = (p - 100) / 11.258799375612023

  const c0 = 0.64344183055453652

  // 5 linear terms.
  const c1 =
    0.0057853744421272994 * z1 +
    -0.021779198563145002 * z2 +
    0.20801807993110405 * z3 +
    -0.031012002753986502 * z4 +
    -0.015369080324581424 * z5

  // 15 quadratic terms.
  const c2 =
    -0.0042008286730074659 * z1 ** 2 +
    -0.00037135506478556957 * z1 * z2 +
    0.0044436287383974038 * z1 * z3 +
    -8.9291308078026654e-5 * z1 * z4 +
    0.0003000710313721261 * z1 * z5 +
    0.0019719022636336403 * z2 ** 2 +
    -0.0040808760007100403 * z2 * z3 +
    0.00029434113090864855 * z2 * z4 +
    -0.00097329493502802678 * z2 * z5 +
    -0.065780233761752085 * z3 ** 2 +
    0.0018261444904990876 * z3 * z4 +
    0.0013883983128735976 * z3 * z5 +
    0.0022097435611447835 * z4 ** 2 +
    0.00032040309679475659 * z4 * z5 +
    0.00031677706652805809 * z5 ** 2

  // 35 cubic terms.
  const c3 =
    0.00037969008795635251 * z1 ** 3 +
    0.00020413198245070735 * z1 ** 2 * z2 +
    -0.0023135230861705061 * z1 ** 2 * z3 +
    0.00076697509104453609 * z1 ** 2 * z4 +
    9.2128452321043816e-5 * z1 ** 2 * z5 +
    7.1868110631265539e-6 * z1 * z2 ** 2 +
    -0.00015311123428898149 * z1 * z2 * z3 +
    4.3650961418745943e-5 * z1 * z2 * z4 +
    -4.2965850519813276e-5 * z1 * z2 * z5 +
    0.00014115579379703311 * z1 * z3 ** 2 +
    -0.00025785775701090037 * z1 * z3 * z4 +
    0.00014276106887232704 * z1 * z3 * z5 +
    -0.00031708550939746306 * z1 * z4 ** 2 +
    -0.00019618956068601009 * z1 * z4 * z5 +
    -0.00038605547422848 * z1 * z5 ** 2 +
    -0.00017600476179462261 * z2 ** 3 +
    -0.00042973318011350469 * z2 ** 2 * z3 +
    0.00012668309782039625 * z2 ** 2 * z4 +
    -3.5237096302331372e-5 * z2 ** 2 * z5 +
    0.0049539718952981609 * z2 * z3 ** 2 +
    -0.00088420753685518414 * z2 * z3 * z4 +
    -0.00045831913022205721 * z2 * z3 * z5 +
    -0.00048472451987899377 * z2 * z4 ** 2 +
    -7.3826345457255583e-5 * z2 * z4 * z5 +
    0.00023112184211685621 * z2 * z5 ** 2 +
    0.0093846158761002677 * z3 ** 3 +
    0.0044205839382310697 * z3 ** 2 * z4 +
    0.001404345029375906 * z3 ** 2 * z5 +
    -0.0025232240363885338 * z3 * z4 ** 2 +
    -0.0007603533788773831 * z3 * z4 * z5 +
    -0.00021933265206988212 * z3 * z5 ** 2 +
    -0.0025080951001530843 * z4 ** 3 +
    3.5930232389173433e-5 * z4 ** 2 * z5 +
    -0.00023136513744060098 * z4 * z5 ** 2 +
    -0.00018089978076030969 * z5 ** 3

  return c0 + c1 + c2 + c3
}
