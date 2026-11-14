import { useState } from 'react'
import { ImagePlus, LoaderCircle } from 'lucide-react'

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const MAX_DATA_URL_LENGTH = 440000
const MAX_IMAGE_EDGE = 1024

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This image could not be opened.')) }
    image.src = objectUrl
  })
}

async function optimizeProfilePicture(file) {
  const image = await loadImage(file)
  const initialScale = Math.min(1, MAX_IMAGE_EDGE / image.naturalWidth, MAX_IMAGE_EDGE / image.naturalHeight)
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale))
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale))

  for (let sizeAttempt = 0; sizeAttempt < 6; sizeAttempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this image.')
    context.drawImage(image, 0, 0, width, height)

    for (const quality of [.88, .8, .72, .64, .56]) {
      const result = canvas.toDataURL('image/webp', quality)
      if (result.length <= MAX_DATA_URL_LENGTH) return result
    }

    width = Math.max(1, Math.round(width * .82))
    height = Math.max(1, Math.round(height * .82))
  }

  throw new Error('This picture is too detailed to prepare. Try a smaller image.')
}

export default function ProfilePicturePicker({ value, onChange }) {
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const choose = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('Choose an image smaller than 5 MB.')
      event.target.value = ''
      return
    }

    setError('')
    setProcessing(true)
    try {
      onChange(await optimizeProfilePicture(file))
    } catch (imageError) {
      setError(imageError.message || 'This image could not be prepared.')
    } finally {
      setProcessing(false)
      event.target.value = ''
    }
  }

  return <div className="profile-picture-picker"><span className="avatar large">{value ? <img src={value} alt="Profile preview" /> : <ImagePlus size={19} />}</span><div><label className="button button-secondary" htmlFor="profile-picture-input" aria-disabled={processing}>{processing ? <><LoaderCircle className="spin" size={15} /> Preparing picture…</> : <><ImagePlus size={15} /> {value ? 'Change picture' : 'Add profile picture'}</>}</label><input id="profile-picture-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={processing} onChange={choose} /><small>Optional. Choose a JPG, PNG, or WebP up to 5 MB. Large photos are resized automatically.</small>{error && <span className="field-error">{error}</span>}</div></div>
}
