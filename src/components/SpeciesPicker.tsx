import { Icon } from './Icons'

const options = [
  { value: '', label: 'All pets', icon: 'paw' },
  { value: 'cat', label: 'Cats', icon: 'cat' },
  { value: 'dog', label: 'Dogs', icon: 'dog' },
] as const

type Props = {
  showLabel?: boolean
  value?: string
  onValueChange?: (value: string) => void
}

export function SpeciesPicker({ showLabel = false, value, onValueChange }: Props) {
  return <fieldset className="species-field">
    <legend className={showLabel ? 'filter-field-label' : 'sr-only'}>Pet type</legend>
    <div className="species-picker">
      {options.map(option => <label key={option.value}>
        <input
          type="radio"
          name="species"
          value={option.value}
          checked={value === undefined ? undefined : value === option.value}
          defaultChecked={value === undefined ? option.value === '' : undefined}
          onChange={onValueChange ? () => onValueChange(option.value) : undefined}
        />
        <Icon kind={option.icon} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>
}
