import React, { Component, PropTypes } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import InputGroup from '../components/InputGroup'
import Image from '../components/Image'

import SecondaryNavBar from '../components/SecondaryNavBar'
import EditProfileHeader from './components/EditProfileHeader'
import ProfileEditingSidebar from './components/ProfileEditingSidebar'
import { IdentityActions } from './store/identity'
import { signProfileForUpload, findAddressIndex } from '../utils/index'
import { uploadProfile, uploadPhoto } from '../account/utils'

import EditSocialAccountItem from './components/EditSocialAccountItem'
import EditPGPAccountItem from './components/EditPGPAccountItem'

import BasicInfoTab      from './tabs/BasicInfoTab'
import PhotosTab         from './tabs/PhotosTab'
import SocialAccountsTab from './tabs/SocialAccountsTab'
import PublicKeysTab     from './tabs/PublicKeysTab'
import PrivateInfoTab    from './tabs/PrivateInfoTab'

import log4js from 'log4js'

const logger = log4js.getLogger('profiles/EditProfilePage.js')

const accountTypes = [
  'twitter',
  'facebook',
  'linkedin',
  'github',
  'instagram',
  'hackernews',
  'bitcoin',
  'ethereum',
  'pgp',
  'ssh'
]

function mapStateToProps(state) {
  return {
    localIdentities: state.profiles.identity.localIdentities,
    api: state.settings.api,
    identityKeypairs: state.account.identityAccount.keypairs,
    identityAddresses: state.account.identityAccount.addresses

  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(IdentityActions, dispatch)
}

class EditProfilePage extends Component {
  static propTypes = {
    updateProfile: PropTypes.func.isRequired,
    localIdentities: PropTypes.object.isRequired,
    api: PropTypes.object.isRequired,
    identityAddresses: PropTypes.array.isRequired,
    identityKeypairs: PropTypes.array.isRequired,
    routeParams: PropTypes.object.isRequired
  }

  constructor(props) {
    super(props)

    this.state = {
      domainName: null,
      profile: null,
      profileJustSaved: false,
      tabName: ""
    }

    this.saveProfile = this.saveProfile.bind(this)
    this.uploadProfilePhoto = this.uploadProfilePhoto.bind(this)
    this.hasUsername = this.hasUsername.bind(this)
    this.onChange = this.onChange.bind(this)
    this.onSocialAccountChange = this.onSocialAccountChange.bind(this)
    this.onChangePhotoClick = this.onChangePhotoClick.bind(this)
    this.createNewAccount= this.createNewAccount.bind(this)
    this.removeAccount = this.removeAccount.bind(this)
  }

  componentWillMount() {
    this.componentHasNewLocalIdentities(this.props)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.localIdentities !== this.props.localIdentities) {
      this.componentHasNewLocalIdentities(nextProps)
    }
  }

  componentWillUnmount() {
    this.saveProfile(this.state.profile)
  }

  componentHasNewLocalIdentities(props) {
    const profileIndex = this.props.routeParams.index
    if (props.localIdentities[profileIndex]) {
      const newDomainName = props.localIdentities[profileIndex].domainName
      const newProfile = props.localIdentities[profileIndex].profile
      newProfile.verifications = props.localIdentities[profileIndex].verifications
      if (profileIndex) {
        this.setState({
          domainName: newDomainName,
          profile: newProfile
        })
      }
    } else {
      // Do nothing
    }
  }

  saveProfile(newProfile) {
    logger.trace('saveProfile')
    this.props.updateProfile(this.props.routeParams.index, newProfile)
    if (this.hasUsername() && this.props.api.storageConnected) {
      logger.trace('saveProfile: Preparing to upload profile')
      const profileIndex = this.props.routeParams.index
      const ownerAddress = this.props.localIdentities[profileIndex].ownerAddress
      const addressIndex = findAddressIndex(ownerAddress, this.props.identityAddresses)
      logger.debug(`saveProfile: signing with key index ${addressIndex}`)

      const data = signProfileForUpload(this.state.profile,
        this.props.identityKeypairs[addressIndex])

      uploadProfile(this.props.api, this.state.domainName, data).catch((err) => {
        console.error(err)
        console.error('profile not uploaded')
      })
    } else {
      logger.trace('saveProfile: No username or storage so we skipped profile upload')
    }
  }

  uploadProfilePhoto(e) {
    const name = this.state.domainName
    let profile = this.state.profile
    uploadPhoto(this.props.api, name, e.target.files[0], 0)
    .then((avatarUrl) => {
      profile.image[0].contentUrl = avatarUrl
      this.setState({
        profile: profile
      })
    })
    .catch((error) => {
      console.error(error)
    })

  }

  hasUsername() {
    const localIdentities = this.props.localIdentities
    const currentDomainName = this.state.domainName
    return currentDomainName !== localIdentities[currentDomainName].ownerAddress
  }

  onChange(event) {
    let profile = this.state.profile
    profile[event.target.name] = event.target.value
    this.setState({profile: profile})
  }

  onChangePhotoClick() {
    this.photoUpload.click()
  }

  onSocialAccountChange(service, event) {
    let profile = this.state.profile
    let identifier = event.target.value

    if (profile.hasOwnProperty('account')) {
      let hasAccount = false
      profile.account.forEach(account => {
        if(account.service === service) {
          hasAccount = true
          if (identifier.length > 0) {
            account.identifier = identifier
            this.setState({profile: profile})
          }
          else {
            this.removeAccount(service, identifier)
          }
        }
      })

      if (!hasAccount && identifier.length > 0) {
        profile.account.push(this.createNewAccount(service, identifier))
        this.setState({profile: profile})
        this.saveProfile(profile)
      }
    }
    else {
      profile.account = []
      profile.account.push(this.createNewAccount(service, identifier))
      this.setState({profile: profile})
      if(identifier.length > 0) {
        this.saveProfile(profile)
      }
    }
  }

  removeAccount(service, identifier) {
    let profile = this.state.profile
    let accounts = profile.account
    let newAccounts = accounts.filter(account => {
      return (account.service !== service && account.identifier !== identifier)
    })
    profile.account = newAccounts
    this.setState({profile: profile})
    this.saveProfile(profile)
  }

  createNewAccount(service, identifier) {
    return {
      '@type': 'Account',
      placeholder: false,
      service: service,
      identifier: identifier,
      proofType: 'http',
      proofUrl: ''
    }
  }

  createPlaceholderAccount(accountType) {
    return {
      "@type": "Account",
      placeholder: true,
      service: accountType,
      identifier: "",
      proofType: "",
      proofURL: "",
    }
  }

  render() {

    const profileIndex = this.props.routeParams.index
    const identity = this.props.localIdentities[profileIndex]
    const verifications = identity.verifications

    // render() sometimes gets called before defaultIdentityName
    // is updated from ownerAddress to the actual name when adding
    // a username.
    if (!identity) {
      return null
    }

    var filledAccounts = []
    var placeholders = []

    if (this.state.profile.hasOwnProperty('account')) {
      accountTypes.forEach((accountType) => {

        var hasAccount = false
        this.state.profile.account.forEach((account) => {
          if (account.service === accountType) {
            hasAccount = true
            account.placeholder = false
            filledAccounts.push(account)
          }
        })

        if(!hasAccount) {
          placeholders.push(this.createPlaceholderAccount(accountType))
        }

      })
    }
    else {
      accountTypes.forEach((accountType) => {
        placeholders.push(this.createPlaceholderAccount(accountType))
      })
    }

    const accounts = filledAccounts.concat(placeholders)

    console.log(accounts)
    console.log(this.state.profile)
    const domainName = this.state.domainName
    return (
      <div>
      {this.state.tabName === '' ? (
        <SecondaryNavBar
          leftButtonTitle="Edit"
          leftButtonLink={`/profiles/${domainName}/edit`}
          isLeftActive
          centerButtonTitle="View"
          centerButtonLink="/profiles"
          rightButtonTitle="More"
          rightButtonLink="/profiles/i/all"
        />
        ) : (
        <SecondaryNavBar
          leftButtonTitle="Edit"
          onLeftButtonClick={() => this.backClick()}
          isLeftActive
          centerButtonTitle="View"
          centerButtonLink="/profiles"
          rightButtonTitle="More"
          rightButtonLink="/profiles/i/all"
        />
        )}

        <div>
          {this.state.profile && this.state.domainName ?
          <div>
            <div className="container-fluid no-padding">
              <div className="row no-gutters">

                <div className="col-12">
                  <div className="avatar-md m-t-50 m-b-10 text-center">
                    <Image
                      src={(this.state.profile.image && this.state.profile.image[0].contentUrl) 
                        ? this.state.profile.image[0].contentUrl : "/images/avatar.png"}
                      fallbackSrc="/images/avatar.png" className="rounded-circle" />
                  </div>
                </div>
                <div className="col-12 text-center">
                    <input type="file" ref={ ref => this.photoUpload = ref} onChange={this.uploadProfilePhoto} style={{display:'none'}} />
                    <button className="btn btn-link active m-b-30" onClick={this.onChangePhotoClick}>
                      Change Photo
                    </button>
                </div>
                
                <div className="col-12">
                  <InputGroup name="givenName" label="First Name"
                      data={this.state.profile}
                      onChange={this.onChange} />
                  <InputGroup name="familyName" label="Last Name"
                      data={this.state.profile}
                      onChange={this.onChange} />
                  <InputGroup name="description" label="Short Bio"
                      data={this.state.profile}
                      onChange={this.onChange} />
                </div>

              </div>
            </div>


            <div className="container-fluid p-0">
              <div className="row m-t-20 p-b-45 no-gutters">
                <div className="col-12">
                  <div className="edit-profile-accounts">
                    {accounts && 
                      accounts.map((account) => {
                        let verified = false
                        if(verifications) {
                          for (let i = 0; i < verifications.length; i++) {
                            const verification = verifications[i]
                            if (verification.service === account.service &&
                              verification.valid === true) {
                              verified = true
                              break
                            }
                          }
                        }
                        if (account.service === 'pgp' || account.service === 'ssh') {
                          return (
                            <EditPGPAccountItem
                              key={`${account.service}`}
                              service={account.service}
                              identifier={account.identifier}
                              contentUrl={account.contentUrl}
                              placeholder={account.placeholder}
                              listItem
                            />
                          )
                        } else {
                          return (
                            <EditSocialAccountItem
                              key={`${account.service}`}
                              service={account.service}
                              identifier={account.identifier}
                              proofUrl={account.proofUrl}
                              listItem
                              verified={verified}
                              placeholder={account.placeholder}
                              onChange={this.onSocialAccountChange}
                            />
                          )
                        }
                      })
                    }

                  </div>
                </div>
              </div>
            </div>


          </div>
          :
          <div>
            <h1 className="h1-modern vertical-split-content">
              Page Not Found
            </h1>
            <p>You don't own this profile and therefore you cannot edit it.</p>
          </div>
          }
        </div>
      </div>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditProfilePage)
