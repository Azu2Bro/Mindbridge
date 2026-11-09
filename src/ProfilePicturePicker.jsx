import { useState } from 'react'
import { ImagePlus } from 'lucide-react'

export default function ProfilePicturePicker({ value, onChange }) {
  const [error, setError] = useState('')
  const choose = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 320000) {
      setError('Choose an image smaller than 320 KB.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result))
    reader.readAsDataURL(file)
  }
  return <div className="profile-picture-picker"><span className="avatar large">{value ? <img src={value} alt="Profile preview" /> : <ImagePlus size={19} />}</span><div><label className="button button-secondary" htmlFor="profile-picture-input"><ImagePlus size={15} /> {value ? 'Change picture' : 'Add profile picture'}</label><input id="profile-picture-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} /><small>Optional. JPG, PNG, or WebP up to 320 KB.</small>{error && <span className="field-error">{error}</span>}</div></div>
}
