import { ComboboxObject } from '../../ui/components/combobox/combobox.pom';
import { ValueNodeEditorObject } from '../../ui/components/value-node-editor/value-node-editor.pom';

/** A node of the Entry form: the shared node editor plus the Tags input Entries projects into it. */
export class EntryNodeEditorObject extends ValueNodeEditorObject {
  get tags(): ComboboxObject {
    return new ComboboxObject(this.root.getByTestId('tags'));
  }
}
